#!/bin/bash

# Script to download and install Plone backups from S3
# Improved workflow with dependency checks and terminal UX
#
# This script is IDENTICAL in every OAG/AO repo. Everything that differs
# between sites lives in dl_backup.env beside it. If you need to change
# behaviour, change it here and copy the script to the other repos; if you
# need to change a value, change it there.

set -e # Exit on error

# Version of this script. Bump the minor/patch for behaviour changes; bump
# DL_BACKUP_ENV_SCHEMA (and the major) only when dl_backup.env gains or
# renames a setting, so an old env file fails loudly instead of silently
# falling back to a default.
DL_BACKUP_VERSION="2.0.1"
DL_BACKUP_ENV_SCHEMA=2

# Setup signal handling and cleanup
cleanup() {
	echo -e "\n${YELLOW}Operation canceled. Cleaning up...${NC}"

	# Remove temporary extraction files if they exist
	if [[ -f "$FILENAME.tmp" ]]; then
		rm -f "$FILENAME.tmp"
	fi

	# Remove partial downloads
	if [[ "$DOWNLOAD_IN_PROGRESS" == true && -n "$FILEDATE" ]]; then
		echo "Removing partial downloads..."
		find . -name "$FILEDATE*" -type f -cmin -5 -delete
	fi

	# Clean up the extraction directory if it was interrupted
	if [[ "$EXTRACTION_IN_PROGRESS" == true && -d "$EXTRACT_DIR" ]]; then
		echo "Removing partial extraction..."
		rm -rf "$EXTRACT_DIR"
	fi

	exit 1
}

# Trap various signals
trap cleanup INT TERM HUP

# Track operations in progress
DOWNLOAD_IN_PROGRESS=false
EXTRACTION_IN_PROGRESS=false

# Color support with auto-detection
if [ -t 1 ]; then
	# Output is going to a terminal - use colors
	COLOR_ENABLED=true
	RED='\033[0;31m'
	GREEN='\033[0;32m'
	YELLOW='\033[0;33m'
	BLUE='\033[0;34m'
	BOLD='\033[1m'
	NC='\033[0m' # No Color
else
	# Output is being piped or redirected - no colors
	COLOR_ENABLED=false
	RED=''
	GREEN=''
	YELLOW=''
	BLUE=''
	BOLD=''
	NC=''
fi

# Message formatting functions
info() {
	# Show info messages in normal and verbose mode
	if [[ $VERBOSITY -ge 1 ]]; then
		echo -e "${BLUE}INFO:${NC} $1"
	fi
}

verbose() {
	# Show verbose messages only in verbose mode
	if [[ $VERBOSITY -eq 2 ]]; then
		echo -e "${BLUE}VERBOSE:${NC} $1"
	fi
}

success() {
	# Show success messages in all modes
	echo -e "${GREEN}SUCCESS:${NC} $1"
}

warn() {
	# Show warning messages in all modes
	echo -e "${YELLOW}WARNING:${NC} $1"
}

error() {
	# Show error messages in all modes
	echo -e "${RED}ERROR:${NC} $1" >&2
}

# Progress display for long-running operations
progress_start() {
	if [[ $VERBOSITY -ge 1 && "$COLOR_ENABLED" == true ]]; then
		echo -ne "$1... "
	fi
}

progress_done() {
	if [[ $VERBOSITY -ge 1 && "$COLOR_ENABLED" == true ]]; then
		echo -e "${GREEN}done${NC}"
	fi
}

# Detect blobstorage file with pattern validation
# Supports both .index-blobstorage.tgz and .fsz-blobstorage.tgz patterns
# Returns the filename via echo, sets exit code for success/failure
# Usage: BLOBSTORAGE_TGZ=$(detect_blobstorage_file "$FILEDATE") || handle_error
detect_blobstorage_file() {
	local date_prefix="$1"
	local index_file=$(ls ./"${date_prefix}"*index-blobstorage.tgz 2>/dev/null | head -1)
	local fsz_file=$(ls ./"${date_prefix}"*fsz-blobstorage.tgz 2>/dev/null | head -1)

	if [[ -n "$index_file" && -n "$fsz_file" ]]; then
		error "Ambiguous: Found both .index-blobstorage.tgz and .fsz-blobstorage.tgz patterns"
		echo "  Found: $index_file" >&2
		echo "  Found: $fsz_file" >&2
		echo "  Please remove one of these files before continuing." >&2
		return 1
	elif [[ -n "$index_file" ]]; then
		echo "$index_file"
		return 0
	elif [[ -n "$fsz_file" ]]; then
		echo "$fsz_file"
		return 0
	else
		return 2 # Not found - let caller handle the error message
	fi
}
# First, check for --help and --version before normal option processing
for arg in "$@"; do
	if [ "$arg" = "--help" ]; then
		show_help=true
	fi
	if [ "$arg" = "--version" ]; then
		show_version=true
	fi
done

if [ -n "$show_version" ]; then
	echo "dl_backup.sh $DL_BACKUP_VERSION (env schema $DL_BACKUP_ENV_SCHEMA)"
	exit 0
fi

# Site-specific settings. These are the only values that differ between
# repos, and every one of them is overridden by dl_backup.env below.
BUCKET=""                          # required: no safe default
FILESTORAGE_DIR="var/filestorage"  # where Data.fs is installed
BLOBSTORAGE_DIR="var/blobstorage"  # where the blobs are installed
EXTRACT_DIR="latest"               # what the blobstorage tarball unpacks to
CURRENT_PREFIX="current-backup-"   # prefix for pre-install snapshots

# Behaviour defaults (can be overridden with command-line args)
MAX_BACKUPS=1
KEEP_CURRENT_BACKUP=true
NON_INTERACTIVE=false
CLEANUP_FILES=false
FORCE_CREATE_DIRS=false
REINSTALL_LATEST=false
VERBOSITY=1 # 0=quiet, 1=normal, 2=verbose

# Load the site-specific settings. The env file lives beside this script, so
# the script still finds it when invoked by an absolute path from a cron job.
# DL_BACKUP_ENV_FILE overrides the location for testing.
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ENV_FILE="${DL_BACKUP_ENV_FILE:-$SCRIPT_DIR/dl_backup.env}"

if [[ ! -f "$ENV_FILE" ]]; then
	error "Configuration file not found: $ENV_FILE"
	echo "  This script reads its site-specific settings (S3 bucket, storage" >&2
	echo "  paths) from dl_backup.env beside it. Copy one from another repo" >&2
	echo "  and edit it, or see dl_backup.sh --help." >&2
	exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

if [[ "${DL_BACKUP_ENV_VERSION:-0}" -ne "$DL_BACKUP_ENV_SCHEMA" ]]; then
	error "Configuration schema mismatch in $ENV_FILE"
	echo "  the file declares schema ${DL_BACKUP_ENV_VERSION:-none}," >&2
	echo "  this script (v$DL_BACKUP_VERSION) requires schema $DL_BACKUP_ENV_SCHEMA." >&2
	echo "  The env file and the script must be updated together." >&2
	exit 1
fi

# Apply whatever the env file set, keeping the built-in default when it is
# silent. Only BUCKET has no fallback.
BUCKET="${DL_BACKUP_BUCKET:-$BUCKET}"
FILESTORAGE_DIR="${DL_BACKUP_FILESTORAGE_DIR:-$FILESTORAGE_DIR}"
BLOBSTORAGE_DIR="${DL_BACKUP_BLOBSTORAGE_DIR:-$BLOBSTORAGE_DIR}"
EXTRACT_DIR="${DL_BACKUP_EXTRACT_DIR:-$EXTRACT_DIR}"
CURRENT_PREFIX="${DL_BACKUP_CURRENT_PREFIX:-$CURRENT_PREFIX}"

# Display help function
display_help() {
	echo "Usage: $0 [OPTIONS]"
	echo "Download and install Plone backups from S3."
	echo
	echo "Options:"
	echo "  -b, --bucket BUCKET  S3 bucket path (default: $BUCKET)"
	echo "  -d, --date DATE      Backup date in YYYY-MM-DD format (default: yesterday)"
	echo "  -m, --max-backups N  Maximum number of ${CURRENT_PREFIX}* directories to keep (default: $MAX_BACKUPS)"
	echo "  -n, --no-backup      Don't create a backup of current data before installing new backup"
	echo "  -r, --reinstall-latest  Reinstall the most recent backup already downloaded (skips download and current backup)"
	echo "  -y, --yes            Non-interactive mode (answer yes to all prompts)"
	echo "  -q, --quiet          Quiet mode (minimal output)"
	echo "  -v, --verbose        Verbose mode (detailed output)"
	echo "  -c, --cleanup        Cleanup downloaded files after successful installation"
	echo "  -f, --force-create-dirs  Create $FILESTORAGE_DIR and $BLOBSTORAGE_DIR directories if missing"
	echo "  -h, --help           Show this help message"
	echo "      --version        Show the script version and env schema"
	echo
	echo "Site configuration (from $ENV_FILE):"
	echo "  bucket        $BUCKET"
	echo "  filestorage   $FILESTORAGE_DIR"
	echo "  blobstorage   $BLOBSTORAGE_DIR"
	echo "  extracts to   $EXTRACT_DIR/"
	echo "  snapshots     $CURRENT_PREFIX*"
	exit 0
}

# If --help was provided, show help and exit
if [ -n "$show_help" ]; then
	display_help
fi

# Process command-line arguments
while getopts "b:d:m:nryqcvfh" opt; do
	case $opt in
	b) BUCKET="$OPTARG" ;;
	d) FILEDATE="$OPTARG" ;;
	m) # Maximum number of backups to keep
		MAX_BACKUPS="$OPTARG"
		;;
	n) # Don't keep current backup
		KEEP_CURRENT_BACKUP=false
		;;
	r) # Reinstall latest backup
		REINSTALL_LATEST=true
		;;
	y) # Non-interactive mode (yes to all prompts)
		NON_INTERACTIVE=true
		;;
	q) # Quiet mode (minimal output)
		VERBOSITY=0
		;;
	v) # Verbose mode (more detailed output)
		VERBOSITY=2
		;;
	c) # Cleanup downloaded files after installation
		CLEANUP_FILES=true
		;;
	f) # Force create directories if missing
		FORCE_CREATE_DIRS=true
		;;
	h)
		display_help
		;;
	*)
		echo "Invalid option. Use -h or --help for usage information."
		exit 1
		;;
	esac
done

# Set QUIET flag for backward compatibility
[[ $VERBOSITY -eq 0 ]] && QUIET=true || QUIET=false

# The bucket is the one setting with no safe default: guessing it would mean
# restoring the wrong site's database.
if [[ -z "$BUCKET" ]]; then
	error "No S3 bucket configured."
	echo "  Set DL_BACKUP_BUCKET in $ENV_FILE, or pass -b s3://..." >&2
	exit 1
fi

# Validate option combinations
if [[ "$REINSTALL_LATEST" == true && -n "$FILEDATE" ]]; then
	warn "Both --reinstall-latest and --date specified."
	warn "Ignoring --date option. Will auto-detect latest backup."
	FILEDATE=""
fi
# Check if we're in a Plone instance directory (after processing options)
if [[ ! -d "$FILESTORAGE_DIR" || ! -d "$BLOBSTORAGE_DIR" ]]; then
	if [[ "$FORCE_CREATE_DIRS" == true || "$NON_INTERACTIVE" == true && "$FORCE_CREATE_DIRS" == true ]]; then
		info "Creating missing Plone instance directories."
		progress_start "Creating $FILESTORAGE_DIR directory"
		mkdir -p "$FILESTORAGE_DIR"
		progress_done
		progress_start "Creating $BLOBSTORAGE_DIR directory"
		mkdir -p "$BLOBSTORAGE_DIR"
		progress_done
		success "Plone instance directories created successfully."
	elif [[ "$NON_INTERACTIVE" == true ]]; then
		error "This doesn't appear to be a Plone instance directory."
		echo "Required directories: $FILESTORAGE_DIR, $BLOBSTORAGE_DIR"
		echo "Use --force-create-dirs flag to create them automatically."
		exit 1
	else
		warn "This doesn't appear to be a Plone instance directory."
		echo "Missing directories: $FILESTORAGE_DIR and/or $BLOBSTORAGE_DIR"
		echo
		read -p "Create the necessary directories and continue? (Y/n/q to quit) [Y] " -n 1 -s -r
		REPLY=${REPLY:-Y}  # Default to Y if empty
		echo -n "${REPLY}" # Display the entered character on same line
		echo               # Now add a newline for the next output
		if [[ $REPLY =~ ^[Qq]$ ]]; then
			info "Aborting script."
			exit 0
		elif [[ $REPLY =~ ^[Yy]$ ]]; then
			info "Creating missing Plone instance directories."
			progress_start "Creating $FILESTORAGE_DIR directory"
			mkdir -p "$FILESTORAGE_DIR"
			progress_done
			progress_start "Creating $BLOBSTORAGE_DIR directory"
			mkdir -p "$BLOBSTORAGE_DIR"
			progress_done
			success "Plone instance directories created successfully."
		else
			error "Cannot continue without proper directory structure."
			exit 1
		fi
	fi
fi

# Find yesterday's date in YYYY-MM-DD format if not specified
if [[ -z "$FILEDATE" ]]; then
	ONEDAY=86400
	YESTERDAYSEC=$(date '+%s')
	let YESTERDAY=YESTERDAYSEC-ONEDAY
	FILEDATE=$(date -d @$YESTERDAY '+%Y-%m-%d')
	info "Using default date: $FILEDATE"
	verbose "Date calculation: Today=$(date '+%Y-%m-%d'), Yesterday=$FILEDATE"
fi

# Make sure the bucket path ends with a slash
[[ "$BUCKET" != */ ]] && BUCKET="${BUCKET}/"

# Workflow variables
DOWNLOAD_REQUIRED=true
DOWNLOADED=false
EXTRACTED=false

# Handle reinstall-latest mode (after workflow variables are initialized)
if [[ "$REINSTALL_LATEST" == true ]]; then
	info "Reinstall mode: Looking for most recent backup in current directory."

	# Find all backup files with YYYY-MM-DD pattern
	# Look for both compressed (.fsz) and extracted files
	BACKUP_DATES=$(ls -1 [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]* 2>/dev/null |
		grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' |
		sed 's/^\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/' |
		sort -u |
		sort -r)

	if [[ -z "$BACKUP_DATES" ]]; then
		error "No backup files found in current directory."
		echo "Looking for files matching pattern: YYYY-MM-DD*"
		echo "Current directory contents:"
		ls -la [0-9][0-9][0-9][0-9]-* 2>/dev/null || echo "  No matching files"
		exit 1
	fi

	# Get the most recent date
	LATEST_DATE=$(echo "$BACKUP_DATES" | head -1)

	# Validate that required files exist for this date
	FSZ_EXISTS=false
	EXTRACTED_EXISTS=false
	BLOBSTORAGE_EXISTS=false

	# Resolve the glob with ls first: [[ -f ]] does not expand globs, so the
	# unquoted-glob form silently tested a literal "<date>*.fsz" filename and
	# was always false. Matches the idiom used on the three lines below.
	[[ -f $(ls "${LATEST_DATE}"*.fsz 2>/dev/null | head -1) ]] && FSZ_EXISTS=true
	[[ -f $(ls "${LATEST_DATE}"* 2>/dev/null | grep -v "\.fsz$" | grep -v "\.tgz$" | head -1) ]] && EXTRACTED_EXISTS=true
	# Check for blobstorage with either .index or .fsz pattern
	if [[ -f $(ls "${LATEST_DATE}"*index-blobstorage.tgz 2>/dev/null | head -1) ]] ||
		[[ -f $(ls "${LATEST_DATE}"*fsz-blobstorage.tgz 2>/dev/null | head -1) ]]; then
		BLOBSTORAGE_EXISTS=true
	fi

	# Check if we have either compressed or extracted Data.fs
	if [[ "$FSZ_EXISTS" == false && "$EXTRACTED_EXISTS" == false ]]; then
		error "No Data.fs file found for latest backup date: $LATEST_DATE"
		echo "Required: ${LATEST_DATE}*.fsz or ${LATEST_DATE}* (extracted)"
		exit 1
	fi

	# Check for blobstorage (either archived or extracted)
	if [[ "$BLOBSTORAGE_EXISTS" == false && ! -d "$EXTRACT_DIR" ]]; then
		error "No blobstorage found for latest backup date: $LATEST_DATE"
		echo "Required: ${LATEST_DATE}*.index-blobstorage.tgz or ${LATEST_DATE}*.fsz-blobstorage.tgz (or the '$EXTRACT_DIR' directory)"
		exit 1
	fi

	# Set FILEDATE and workflow flags (these now override the defaults)
	FILEDATE="$LATEST_DATE"
	DOWNLOAD_REQUIRED=false
	KEEP_CURRENT_BACKUP=false

	success "Found latest backup: $FILEDATE"
	info "Skipping download and current backup creation."
fi

# SECTION 1: Check for existing backups (skip in reinstall mode)
if [[ "$REINSTALL_LATEST" == true ]]; then
	verbose "Reinstall mode: Skipping existing backup check."
else
	YEAR=$(echo $FILEDATE | cut -c1-4)
	EXISTING_BACKUPS=$(ls ./"$YEAR"* 2>/dev/null || echo "")

	if [[ -n "$EXISTING_BACKUPS" ]]; then
		info "Found existing backup files from $YEAR:"
		if [[ "$QUIET" != true ]]; then
			echo "$EXISTING_BACKUPS" | sed 's/^/  /' # Indent the file list
		fi

		if [[ "$NON_INTERACTIVE" == true ]]; then
			info "Non-interactive mode: Removing existing backup files."
			progress_start "Removing files"
			rm -f ./"$YEAR"*
			progress_done
		else
			read -p "Remove existing backup files? (Y/n/q to quit) [Y] " -n 1 -s -r
			REPLY=${REPLY:-Y}  # Default to Y if empty
			echo -n "${REPLY}" # Display the entered character on same line
			echo               # Now add a newline for the next output
			if [[ $REPLY =~ ^[Qq]$ ]]; then
				info "Aborting script."
				exit 0
			elif [[ $REPLY =~ ^[Yy]$ ]]; then
				progress_start "Removing existing backup files"
				rm -f ./"$YEAR"*
				progress_done
			else
				info "Keeping existing backup files."

				# Check if backup exists (either .fsz or already extracted)
				if [[ -f $(ls ./"$FILEDATE"*.fsz 2>/dev/null | head -1) || -f $(ls ./"$FILEDATE"* 2>/dev/null | grep -v "\.index-blobstorage\.tgz" | head -1) ]]; then
					read -p "Found backup for $FILEDATE. Skip download? (Y/n/q to quit) [Y] " -n 1 -s -r
					REPLY=${REPLY:-Y}  # Default to Y if empty
					echo -n "${REPLY}" # Display the entered character on same line
					echo               # Now add a newline for the next output
					if [[ $REPLY =~ ^[Qq]$ ]]; then
						info "Aborting script."
						exit 0
					elif [[ $REPLY =~ ^[Yy]$ ]]; then
						DOWNLOAD_REQUIRED=false
						info "Using existing backup files."
					fi
				fi
			fi
		fi
	fi
fi

# Remove existing extraction directory (skip in reinstall mode to preserve extracted data)
if [[ -d "$EXTRACT_DIR" && "$REINSTALL_LATEST" != true ]]; then
	progress_start "Removing existing $EXTRACT_DIR directory"
	rm -rf "$EXTRACT_DIR"
	progress_done
elif [[ -d "$EXTRACT_DIR" && "$REINSTALL_LATEST" == true ]]; then
	verbose "Reinstall mode: Keeping existing $EXTRACT_DIR directory."
fi

# SECTION 2: Download new backup
if [[ "$DOWNLOAD_REQUIRED" == true ]]; then
	if [[ "$NON_INTERACTIVE" == true ]]; then
		info "Non-interactive mode: Downloading $FILEDATE backup from $BUCKET"
		progress_start "Downloading files"
		DOWNLOAD_IN_PROGRESS=true
		aws s3 cp "$BUCKET" . --recursive --exclude "*" --include "$FILEDATE*" ${QUIET:+--quiet}
		DOWNLOAD_IN_PROGRESS=false

		# Check if any files were actually downloaded
		if [[ -f $(ls ./"$FILEDATE"*.fsz 2>/dev/null | head -1) ]]; then
			DOWNLOADED=true
			progress_done
			success "Download completed successfully."
		else
			error "No backup files found for $FILEDATE in $BUCKET"
			echo "Check if the backup exists and your AWS credentials are correct."
			exit 1
		fi
	else
		read -p "Download backup from $BUCKET for $FILEDATE? (Y/n/q to quit) [Y] " -n 1 -s -r
		REPLY=${REPLY:-Y}  # Default to Y if empty
		echo -n "${REPLY}" # Display the entered character on same line
		echo               # Now add a newline for the next output
		if [[ $REPLY =~ ^[Qq]$ ]]; then
			info "Aborting script."
			exit 0
		elif [[ $REPLY =~ ^[Yy]$ ]]; then
			info "Downloading $FILEDATE backup from $BUCKET"
			progress_start "Downloading files"
			DOWNLOAD_IN_PROGRESS=true
			AWS_CMD="aws s3 cp \"$BUCKET\" . --recursive --exclude \"*\" --include \"$FILEDATE*\" ${QUIET:+--quiet}"
			verbose "Executing: $AWS_CMD"
			aws s3 cp "$BUCKET" . --recursive --exclude "*" --include "$FILEDATE*" ${QUIET:+--quiet}
			DOWNLOAD_IN_PROGRESS=false

			# Check if any files were actually downloaded
			if [[ -f $(ls ./"$FILEDATE"*.fsz 2>/dev/null | head -1) ]]; then
				DOWNLOADED=true
				progress_done
				success "Download completed successfully."
			else
				error "No backup files found for $FILEDATE in $BUCKET"
				echo "Check if the backup exists and your AWS credentials are correct."
				exit 1
			fi
		else
			info "Download skipped. Checking for existing backup files."
			# If no download and no existing files, we can't continue
			# Check for both .fsz files and already extracted files
			if [[ ! -f $(ls ./"$FILEDATE"*.fsz 2>/dev/null | head -1) && ! -f $(ls ./"$FILEDATE"* 2>/dev/null | grep -v "\.index-blobstorage\.tgz" | head -1) ]]; then
				error "No backup files for $FILEDATE found and download was skipped."
				echo "Cannot continue without backup files."
				exit 1
			fi
		fi
	fi
else
	DOWNLOADED=true # We're using existing files
fi

# SECTION 3: Extract backup files if they exist
# Try to find backup files - either compressed .fsz or already extracted files with timestamps
FSZ_FILE=$(ls ./"$FILEDATE"*.fsz 2>/dev/null | head -1)
EXTRACTED_FILE=$(ls ./"$FILEDATE"* 2>/dev/null | grep -v "\.tgz$" | grep -v "\.fsz$" | head -1)

if [[ -n "$FSZ_FILE" ]]; then
	# Compressed file found
	FILENAME=$(basename "$FSZ_FILE" .fsz)
	info "Using compressed backup file: ${BOLD}$FILENAME.fsz${NC}"
elif [[ -n "$EXTRACTED_FILE" ]]; then
	# Already extracted file found with timestamp
	FILENAME=$(basename "$EXTRACTED_FILE")
	info "Using already extracted file: ${BOLD}$FILENAME${NC}"
elif [[ -f "$FILEDATE" ]]; then
	# Exact date match without timestamp
	FILENAME="$FILEDATE"
	info "Using already extracted file: ${BOLD}$FILENAME${NC}"
else
	error "No backup file found for $FILEDATE."
	echo "Available files:"
	ls -la ./"$FILEDATE"* 2>/dev/null || echo "None"
	exit 1
fi

# Extract Data.fs if needed
if [[ ! -f "$FILENAME" ]]; then
	info "Extracting Data.fs from $FILENAME.fsz"
	progress_start "Extracting Data.fs"
	EXTRACTION_IN_PROGRESS=true
	if gunzip -S .fsz "$FILENAME.fsz"; then
		EXTRACTION_IN_PROGRESS=false
		progress_done
		success "Data.fs extraction completed."
	else
		EXTRACTION_IN_PROGRESS=false
		error "Failed to extract Data.fs."
		exit 1
	fi
else
	info "Data.fs already extracted."
fi

# Extract blobstorage if needed
# Use helper function to detect blobstorage with either .index or .fsz pattern
# The || guard keeps set -e from silently killing the script when detection fails
BLOBSTORAGE_DETECT_STATUS=0
BLOBSTORAGE_TGZ=$(detect_blobstorage_file "$FILEDATE") || BLOBSTORAGE_DETECT_STATUS=$?

# Handle detection results
if [[ $BLOBSTORAGE_DETECT_STATUS -eq 1 ]]; then
	# Ambiguous: both patterns found - error was already printed
	exit 1
fi

if [[ ! -d "$EXTRACT_DIR" && -n "$BLOBSTORAGE_TGZ" ]]; then
	info "Extracting blobstorage from $BLOBSTORAGE_TGZ"
	progress_start "Extracting blobstorage"
	EXTRACTION_IN_PROGRESS=true
	if tar xfz "$BLOBSTORAGE_TGZ"; then
		EXTRACTION_IN_PROGRESS=false
		EXTRACTED=true
		progress_done
		success "Blobstorage extraction completed."
	else
		EXTRACTION_IN_PROGRESS=false
		error "Failed to extract blobstorage."
		exit 1
	fi
elif [[ -d "$EXTRACT_DIR" ]]; then
	EXTRACTED=true
	info "Blobstorage already extracted."
else
	error "Blobstorage archive not found."
	echo "Looking for: $FILEDATE*.index-blobstorage.tgz or $FILEDATE*.fsz-blobstorage.tgz"
	ls -la ./"$FILEDATE"* 2>/dev/null || echo "No matching files found"
	exit 1
fi

# SECTION 4: Install backup
if [[ "$EXTRACTED" == true && -f "$FILENAME" && -d "$EXTRACT_DIR" ]]; then
	if [[ "$NON_INTERACTIVE" == true ]]; then
		echo "Non-interactive mode: Installing backup."
		# Handle current data backup
		if [[ "$KEEP_CURRENT_BACKUP" == true && -f "$FILESTORAGE_DIR"/Data.fs ]]; then
			echo "Creating backup of current Data.fs."
			CURRENT_BACKUP="$CURRENT_PREFIX$(date +%Y%m%d%H%M%S)"
			mkdir -p "$CURRENT_BACKUP"
			cp "$FILESTORAGE_DIR"/Data.fs* "$CURRENT_BACKUP/" 2>/dev/null || true
			echo "Current Data.fs backed up to $CURRENT_BACKUP/"

			# Check for old backups
			BACKUPS=($(ls -dt "$CURRENT_PREFIX"* 2>/dev/null))
			BACKUP_COUNT=${#BACKUPS[@]}

			if [[ $BACKUP_COUNT -gt $MAX_BACKUPS ]]; then
				echo "Found $BACKUP_COUNT backup directories, limit is $MAX_BACKUPS."

				# Automatically remove old backups in non-interactive mode
				for ((i = MAX_BACKUPS; i < BACKUP_COUNT; i++)); do
					OLD_BACKUP="${BACKUPS[$i]}"
					echo "Removing old backup: $OLD_BACKUP"
					rm -rf "$OLD_BACKUP"
				done
			fi
		else
			echo "Skipping backup of current data."
		fi
	else
		read -p "Install backup? WARNING: This will replace your current Data.fs and blobstorage. (Y/n/q to quit) [Y] " -n 1 -s -r
		REPLY=${REPLY:-Y}  # Default to Y if empty
		echo -n "${REPLY}" # Display the entered character on same line
		echo               # Now add a newline for the next output
		if [[ $REPLY =~ ^[Qq]$ ]]; then
			echo "Aborting script."
			exit 0
		elif [[ ! $REPLY =~ ^[Yy]$ ]]; then
			echo "Installation skipped. Extracted files remain available in the current directory."
			exit 0
		fi

		# Handle current data backup in interactive mode
		if [[ "$KEEP_CURRENT_BACKUP" == true && -f "$FILESTORAGE_DIR"/Data.fs ]]; then
			echo "Creating backup of current Data.fs."
			CURRENT_BACKUP="$CURRENT_PREFIX$(date +%Y%m%d%H%M%S)"
			mkdir -p "$CURRENT_BACKUP"
			cp "$FILESTORAGE_DIR"/Data.fs* "$CURRENT_BACKUP/" 2>/dev/null || true
			echo "Current Data.fs backed up to $CURRENT_BACKUP/"

			# Check for old backups
			BACKUPS=($(ls -dt "$CURRENT_PREFIX"* 2>/dev/null))
			BACKUP_COUNT=${#BACKUPS[@]}

			if [[ $BACKUP_COUNT -gt $MAX_BACKUPS ]]; then
				echo "Found $BACKUP_COUNT backup directories, limit is $MAX_BACKUPS."

				# Process each backup beyond the limit
				for ((i = MAX_BACKUPS; i < BACKUP_COUNT; i++)); do
					OLD_BACKUP="${BACKUPS[$i]}"
					echo "Old backup: $OLD_BACKUP"

					read -p "Remove this backup directory? (Y/n/q to quit) [Y] " -n 1 -s -r
					REPLY=${REPLY:-Y}  # Default to Y if empty
					echo -n "${REPLY}" # Display the entered character on same line
					echo               # Now add a newline for the next output
					if [[ $REPLY =~ ^[Qq]$ ]]; then
						info "Aborting script."
						exit 0
					elif [[ $REPLY =~ ^[Yy]$ ]]; then
						info "Removing $OLD_BACKUP"
						rm -rf "$OLD_BACKUP"
						success "Backup removed."
					else
						info "Keeping $OLD_BACKUP"
					fi
				done
			fi
		else
			echo "Skipping backup of current data."
		fi
	fi

	# Proceed with installation (same for both interactive and non-interactive)
	echo "Removing current Data.fs files."
	rm -f "$FILESTORAGE_DIR"/Data.fs "$FILESTORAGE_DIR"/Data.fs.index "$FILESTORAGE_DIR"/Data.fs.lock "$FILESTORAGE_DIR"/Data.fs.tmp

	echo "Removing current blobstorage content."
	rm -rf "$BLOBSTORAGE_DIR"/0x00 "$BLOBSTORAGE_DIR"/tmp "$BLOBSTORAGE_DIR"/.layout

	echo "Installing new blobstorage."
	if [[ -d "$EXTRACT_DIR"/blobstorage ]]; then
		cp -r "$EXTRACT_DIR"/blobstorage/* "$BLOBSTORAGE_DIR"/
		cp "$EXTRACT_DIR"/blobstorage/.layout "$BLOBSTORAGE_DIR"/ 2>/dev/null || true
	else
		echo "ERROR: Required blobstorage directory structure not found."
		exit 1
	fi

	echo "Installing new Data.fs."
	# Verify Data.fs file exists before attempting to copy
	if [[ -f "$FILENAME" ]]; then
		cp "$FILENAME" "$FILESTORAGE_DIR"/Data.fs
		echo "Data.fs installed successfully."

		# Check for index file
		if [[ -f "$FILENAME.index" ]]; then
			cp "$FILENAME.index" "$FILESTORAGE_DIR"/Data.fs.index
			echo "Data.fs.index installed successfully."
		else
			echo "WARNING: No index file found for Data.fs. A new one will be created when Plone starts."
		fi
	else
		echo "ERROR: Data.fs file '$FILENAME' not found. Cannot complete installation."
		exit 1
	fi

	echo "Backup installation completed successfully."

	# Add cleanup option for downloaded files
	if [[ "$CLEANUP_FILES" == true ]]; then
		echo "Cleaning up downloaded files."
		rm -f ./"$FILEDATE"*
		rm -rf "$EXTRACT_DIR"
		echo "Cleanup completed."
	fi

	echo "You can now start your Plone instance."
else
	echo "ERROR: Required files missing. Cannot proceed with installation."
	if [[ ! -f "$FILENAME" ]]; then echo "Missing: $FILENAME (Data.fs)"; fi
	if [[ ! -d "$EXTRACT_DIR" ]]; then echo "Missing: $EXTRACT_DIR directory"; fi
	exit 1
fi

# Final completion message
if [[ $VERBOSITY -eq 0 ]]; then
	success "Script completed."
elif [[ $VERBOSITY -eq 1 ]]; then
	success "Backup operation completed successfully."
else
	success "Backup operation completed successfully."
	verbose "Summary:"
	verbose "- Date: $FILEDATE"
	verbose "- Bucket: $BUCKET"
	verbose "- Backup file: $FILENAME"
	verbose "- Keep current backup: $KEEP_CURRENT_BACKUP"
	verbose "- Max backups: $MAX_BACKUPS"
	verbose "- Cleanup files: $CLEANUP_FILES"
fi
