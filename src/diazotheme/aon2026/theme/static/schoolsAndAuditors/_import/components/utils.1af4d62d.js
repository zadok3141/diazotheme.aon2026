import * as Inputs from "../../_observablehq/stdlib/inputs.90adaea0.js";
import _ from "../../_npm/lodash@4.17.21/1ecf91d1.js";
import { icon, layer } from "../../_npm/@fortawesome/fontawesome-svg-core@7.0.0/750b31ca.js";
import { faCircle, faSchoolCircleCheck } from "../../_npm/@fortawesome/free-solid-svg-icons@7.0.0/1835f9e0.js";

/**
 * Extract coordinates from a school data item
 * @param {Object} item - The school data item containing location or latitude/longitude
 * @returns {Object} An object with lat and lng properties
 */
export function extractSchoolCoordinates(item) {
    // If the item already has processed coordinates, return them
    if (item.validLat !== undefined && item.validLng !== undefined) {
        return { lat: item.validLat, lng: item.validLng };
    }

    // Default coordinates deliberately set in the ocean to highlight missing data
    const defaultLat = -34;
    const defaultLng = 165;

    let lat = defaultLat;
    let lng = defaultLng;
    let hasRealCoordinates = false;

    // First check for Location field (new format: "latitude, longitude")
    if (item.Location && item.Location !== "#N/A") {
        const locationParts = item.Location.split(',').map(part => part.trim());

        if (locationParts.length === 2) {
            const parsedLat = parseFloat(locationParts[0]);
            const parsedLng = parseFloat(locationParts[1]);

            if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                lat = parsedLat;
                lng = parsedLng;
                hasRealCoordinates = true;
            }
        }
    }
    // Fall back to separate Latitude/Longitude fields (old format)
    else if (item.Latitude && item.Longitude) {
        const parsedLat = item.Latitude !== "#N/A" ? parseFloat(item.Latitude.trim()) : NaN;
        const parsedLng = item.Longitude !== "#N/A" ? parseFloat(item.Longitude.trim()) : NaN;

        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
            lat = parsedLat;
            lng = parsedLng;
            hasRealCoordinates = true;
        }
    }

    // Store the processed coordinates on the item for future use
    item.validLat = lat;
    item.validLng = lng;
    item.hasRealCoordinates = hasRealCoordinates;

    return { lat: lat, lng: lng };
}

/**
 * Creates a table displaying values for a specific field with counts
 * @param {Array} filteredData - The filtered data for counts
 * @param {Array} [allData=null] - Optional complete dataset for all possible values
 * @param {string} fieldName - The field to extract values from
 * @param {string} displayTitle - The title for the table
 * @param {Function} onSelectionChange - Callback function when selection changes
 * @param {Array} initialSelections - Array of initially selected values
 * @returns {HTMLElement} The created table element
 */
export function createFilterableFieldTable(filteredData, allData = null, fieldName, displayTitle, onSelectionChange, initialSelections = []) {
    // Determine which dataset to use for possible values
    const dataForValues = allData || filteredData;

    // Get all possible values from the dataset
    const allPossibleValues = new Set();

    // For Type fields, we need to check all three type columns
    if (fieldName === "Type 1") {
        dataForValues.forEach(item => {
            if (item["Type 1"]) allPossibleValues.add(item["Type 1"]);
            if (item["Type 2"]) allPossibleValues.add(item["Type 2"]);
            if (item["Type 3"]) allPossibleValues.add(item["Type 3"]);
        });
    } else {
        // For other fields, just check the specific field
        dataForValues.forEach(item => {
            if (item[fieldName]) allPossibleValues.add(item[fieldName]);
        });
    }

    // Count occurrences in the filtered data
    const fieldValueCounts = new Map();

    // Initialize all possible values with count 0 if we're using allData
    if (allData) {
        allPossibleValues.forEach(value => {
            fieldValueCounts.set(value, 0);
        });
    }

    // Count occurrences in filtered data
    if (fieldName === "Type 1") {
        // For Type, count across all three type columns
        filteredData.forEach(item => {
            if (item["Type 1"] && allPossibleValues.has(item["Type 1"])) {
                fieldValueCounts.set(item["Type 1"], (fieldValueCounts.get(item["Type 1"]) || 0) + 1);
            }
            if (item["Type 2"] && allPossibleValues.has(item["Type 2"])) {
                fieldValueCounts.set(item["Type 2"], (fieldValueCounts.get(item["Type 2"]) || 0) + 1);
            }
            if (item["Type 3"] && allPossibleValues.has(item["Type 3"])) {
                fieldValueCounts.set(item["Type 3"], (fieldValueCounts.get(item["Type 3"]) || 0) + 1);
            }
        });
    } else {
        // For other fields, just count the specific field
        filteredData.forEach(item => {
            if (item[fieldName] && allPossibleValues.has(item[fieldName])) {
                fieldValueCounts.set(item[fieldName], (fieldValueCounts.get(item[fieldName]) || 0) + 1);
            }
        });
    }

    // Convert to array (no manual sorting needed)
    const valueCountsArray = Array.from(fieldValueCounts.entries());

    // Create data array for table
    const tableRowData = valueCountsArray.map(([value, count]) => ({
        [displayTitle]: value,
        "Count": count
    }));

    // Find which rows should be initially selected
    let initialValue = [];
    if (initialSelections && initialSelections.length > 0) {
        initialValue = tableRowData.filter(row =>
            initialSelections.includes(row[displayTitle])
        );
    }

    // Create the table with initial selections
    const table = Inputs.table(tableRowData, {
        columns: [displayTitle, "Count"],
        layout: "auto",
        sort: "Count", // Sort by Count column
        reverse: true, // Sort in descending order
        rows: 7, // Show up to 10 rows
        multiple: true,
        width: "100%",
        required: false,
        value: initialValue
    });

    // Add selection event listener
    if (onSelectionChange) {
        table.addEventListener('input', () => {
            const selectedValues = table.value ?
                table.value.map(item => item[displayTitle]) :
                [];
            onSelectionChange(fieldName, selectedValues);
        });
    }

    return table;
}

// Alias for backward compatibility - will be deprecated
export const createFilterableFieldTableWithAllOptions = createFilterableFieldTable;

// Map to store school-to-marker references for quick lookup
const schoolMarkerMap = new Map();

/**
 * Creates a unique hash for a school item
 * @param {Object} item - The school data object
 * @returns {string} A unique hash string
 */
function createSchoolItemHash(item) {
    // Use JSON.stringify to convert the entire object to a string
    // This ensures all properties are included in the hash
    return JSON.stringify(item);
}

/**
 * Creates a popup content string for a school
 * @param {Object} item - The school data object
 * @returns {string} HTML content for the popup
 */
function createSchoolPopupContent(item) {
    return `
    <h1 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${item["School name"]}</h1>
    ${item["School Type"] ? `<p style="margin: 0 0 8px 0">${item["School Type"]}</p>` : ''}
    ${item["ASP"] ? `<p style="margin: 0 0 8px 0">${item["ASP"]}</p>` : ''}
    ${item["AA"] ? `<p style="margin: 0 0 8px 0">${item["AA"]}</p>` : ''}
    ${item["Regional council"] ? `<p style="margin: 0 0 8px 0">${item["Regional council"]}</p>` : ''}
    ${item["Territorial authority"] ? `<p style="margin: 0 0 8px 0">${item["Territorial authority"]}</p>` : ''}
    ${item["Financial Service Provider"] ? `<p style="margin: 0 0 8px 0">${item["Financial Service Provider"]}</p>` : ''}`;
}

/**
 * Creates map markers for each school and adds them to the map
 * @param {Array} schools - Array of school data objects
 * @param {L.LayerGroup} markerLayer - Leaflet layer group to add markers to
 * @param {Array} markerReferences - Array to store references to created markers
 * @param {L.Map} mapInstance - The Leaflet map instance
 */
export function createSchoolMapMarkers(schools, markerLayer, markerReferences, mapInstance) {
    mapInstance.eachLayer(function(layer) {
        if (typeof layer._popup != 'undefined') {
            layer.remove()
        }
    });

    // Clear the markerReferences array and marker map
    markerReferences.length = 0;
    schoolMarkerMap.clear();

    schools.forEach(function(item) {
        // Use the pre-processed coordinates directly
        var marker = L.marker([item.validLat, item.validLng])
            .bindPopup(createSchoolPopupContent(item));

        // Store references to the marker using a unique hash
        markerReferences.push(marker);
        const uniqueHash = createSchoolItemHash(item);
        schoolMarkerMap.set(uniqueHash, marker);
        marker.setOpacity(100);
        marker.addTo(markerLayer);
    });

    markerLayer.addTo(mapInstance);
}

/**
 * Updates filter state and triggers display refresh
 * @param {string} fieldName - The field name that was changed
 * @param {Array} selectedValues - The new selected values
 * @param {Object} filterState - The filters object to update
 * @param {Function} refreshCallback - Callback function to refresh the display
 */
export function updateFilterAndRefresh(fieldName, selectedValues, filterState, refreshCallback) {
    filterState[fieldName] = selectedValues;
    refreshCallback();
}

/**
 * Creates and renders filter tables for data filtering
 * @param {Array} filteredData - The currently filtered data
 * @param {string} containerId - The ID of the container element
 * @param {Function} selectionHandler - The handler function for selection changes
 * @param {Object} filterState - The current filters
 * @param {Function} refreshCallback - Callback function to refresh the display
 * @param {Array} allData - The complete unfiltered dataset
 */
export function renderFilterTables(filteredData, containerId, selectionHandler, filterState, refreshCallback, allData) {
    // Get the existing container
    const tablesContainer1 = document.getElementById(containerId[0]);
    const tablesContainer2 = document.getElementById(containerId[1]);
    // Clear the container
    tablesContainer1.innerHTML = '';
    tablesContainer2.innerHTML = '';

    // Create field tables with preserved selections
    const filterFields = [
        { field: "ASP", title: "ASP" },
        { field: "AA", title: "AA" },
        { field: "School Type", title: "School Type" },
        { field: "Regional council", title: "Regional council" },
        { field: "Territorial authority", title: "Territorial authority" },
        { field: "Financial Service Provider", title: "Financial Service Provider" }
    ];

    // Use Lodash forEach for cleaner iteration
    let tableCount = 0
    _.forEach(filterFields, ({ field, title }) => {
        tableCount++;
        const tableDiv = document.createElement('div');
        tableDiv.className = 'field-table';

        // Create the table with all possible values from the complete dataset
        // but show counts from the filtered data
        const table = createFilterableFieldTable(
            filteredData,  // For counts
            allData,       // For all possible values
            field,
            title,
            (fieldName, selectedValues) => selectionHandler(fieldName, selectedValues, filterState, refreshCallback),
            filterState[field] // Pass current selections
        );

        tableDiv.appendChild(table);
        if (tableCount > 3) {
            tablesContainer2.appendChild(tableDiv);
        } else {
            tablesContainer1.appendChild(tableDiv);
        }
    });
}

/**
 * Creates a function that refreshes the display with current filters
 * @param {Array} schoolData - The original unfiltered schools data
 * @param {Object} filterState - Object containing filter selections for different fields
 * @param {L.LayerGroup} markerLayer - Leaflet layer group for school markers
 * @param {Array} markerReferences - Array to store references to created markers
 * @param {L.Map} mapInstance - The Leaflet map instance
 * @param {Object} displayOptions - Additional options including columns, layout, and icons
 * @param {string} filterContainerId - The ID of the container for filter tables
 * @returns {Function} A function that refreshes the display
 */
export function createDisplayRefresher(schoolData, filterState, markerLayer, markerReferences, mapInstance, displayOptions, filterContainerId) {
    return function refreshView() {
        // Use Lodash for proper deep cloning of options
        const refreshOptions = _.cloneDeep(displayOptions);
        refreshOptions.refreshCallback = refreshView;
        refreshOptions.allData = schoolData;  // Ensure the complete dataset is available

        return refreshFilteredDisplay(schoolData, filterState, markerLayer, markerReferences, mapInstance, refreshOptions, filterContainerId);
    };
}

/**
 * Updates the display based on current filters
 * @param {Array} schoolData - The original unfiltered schools data
 * @param {Object} filterState - Object containing filter selections for different fields
 * @param {L.LayerGroup} markerLayer - Leaflet layer group for school markers
 * @param {Array} markerReferences - Array to store references to created markers
 * @param {L.Map} mapInstance - The Leaflet map instance
 * @param {Object} displayOptions - Additional options including columns, layout, and icons
 * @param {string} filterContainerId - The ID of the container for filter tables
 * @returns {Array} The filtered results
 */
export function refreshFilteredDisplay(schoolData, filterState, markerLayer, markerReferences, mapInstance, displayOptions, filterContainerId) {
    // Filter the schools based on selected values using Lodash
    const filteredSchools = _.filter(schoolData, item => {
        // If no filters are set for a category, it passes that filter
        const aspFilter = filterState["ASP"].length === 0 ||
                          filterState["ASP"].includes(item["ASP"]);

        const aaFilter = filterState["AA"].length === 0 ||
              filterState["AA"].includes(item["AA"]);

        const typeFilter = filterState["School Type"].length === 0 ||
                            filterState["School Type"].includes(item["School Type"]);

        const regionalFilter = filterState["Regional council"].length === 0 ||
              filterState["Regional council"].includes(item["Regional council"]);

        const territorialFilter = filterState["Territorial authority"].length === 0 ||
              filterState["Territorial authority"].includes(item["Territorial authority"]);

        const fspFilter = filterState["Financial Service Provider"].length === 0 ||
              filterState["Financial Service Provider"].includes(item["Financial Service Provider"]);

        return aspFilter && aaFilter && typeFilter && regionalFilter && territorialFilter && fspFilter;
    });

    // Update the map
    createSchoolMapMarkers(filteredSchools, markerLayer, markerReferences, mapInstance);

    // Update the main table
    const tableDiv = document.getElementById('table_div');
    tableDiv.innerHTML = '';  // Clear existing content

    // Create and add the table display
    tableDiv.appendChild(createSelectableSchoolTable(
        filteredSchools,
        displayOptions.columns,
        displayOptions.layout,
        markerReferences,
        mapInstance
    ));

    // Update filter tables with the new filtered data and all possible options
    renderFilterTables(
        filteredSchools,
        filterContainerId,
        updateFilterAndRefresh,
        filterState,
        displayOptions.refreshCallback,
        displayOptions.allData || schoolData  // Pass the complete dataset
    );

    return filteredSchools;
}

/**
 * Creates a highlighted icon for selected schools
 * @returns {L.DivIcon} The created icon
 */
function createHighlightedIcon() {
    return L.divIcon({
        html: layer((push) => {
            push(icon(faCircle, {
                transform: {
                    size: 64,
                    y: -28
                },
                styles: {
                    'color': 'transparent'
                }
            }))
            push(icon(faSchoolCircleCheck, {
                transform: {
                    size: 36,
                    x: -2,
                    y: -28
                },
                styles: {
                    'color': 'red'
                }
            }))
        }).html,
        className: 'selected-school-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -36]
    });
}


/**
 * Creates and configures the Inputs table with event listeners for selection
 * @param {Array} schools - Array of school data objects
 * @param {Array} columnConfig - Array of column names to display
 * @param {string} layoutStyle - Layout style for the table
 * @param {Array} markerReferences - Array of map markers
 * @param {L.Map} mapInstance - The Leaflet map instance
 * @returns {HTMLElement} The created table element
 */
export function createSelectableSchoolTable(schools, columnConfig, layoutStyle, markerReferences, mapInstance) {
    // Create the highlighted icon once
    const highlightedIcon = createHighlightedIcon();

    const selection = Inputs.table(schools, {
        columns: columnConfig,
        layout: layoutStyle,
        sort: "School",
        rows: 27,
        multiple: true,
        required: false
    });

    // Add a selection event listener
    selection.addEventListener('input', () => {
        // Reset all markers to default state but invisible
        markerReferences.forEach(marker => {
            marker.setIcon(L.Icon.Default.prototype);
            marker.setZIndexOffset(Math.round(marker.getLatLng().lat)); // Use latitude as default z-index
            marker.closePopup();
            marker.setOpacity(0);
        });

        if (selection.value && selection.value.length > 0) { // Check if there are selected rows
            // Create bounds to fit all selected markers
            const bounds = L.latLngBounds();

            // Process each selected row
            selection.value.forEach(row => {
                // Get marker using the unique hash
                const uniqueHash = createSchoolItemHash(row);
                const marker = schoolMarkerMap.get(uniqueHash);

                if (marker) {
                    marker.setIcon(highlightedIcon);
                    marker.setZIndexOffset(1000);
                    marker.setOpacity(100);

                    // Only open popup if exactly one item is selected
                    if (selection.value.length === 1) {
                        marker.openPopup();
                    } else {
                        marker.closePopup();
                    }

                    bounds.extend(marker.getLatLng());
                }
            });

            // If we have selected markers, fit the map to show all of them
            if (!bounds.isValid()) {
                mapInstance.setView([-40.9, 175.232], 5); // Reset to default view if no valid bounds
            } else {
                // Add extra padding when only one marker is selected to accommodate popup
                if (selection.value.length === 1) {
                    // Get marker using the unique hash
                    const uniqueHash = createSchoolItemHash(selection.value[0]);
                    const marker = schoolMarkerMap.get(uniqueHash);

                    if (marker) {
                        marker.openPopup();
                        // Wait for popup to be created and rendered
                        setTimeout(() => {
                            const popupElement = marker.getPopup().getElement();
                            // Set a maximum height of 495px for the popup
                            const maxPopupHeight = 495;
                            const popupHeight = Math.min(
                                popupElement ? popupElement.offsetHeight : 150, // fallback to 150 if can't measure
                                maxPopupHeight
                            );

                            // Add extra padding when only one marker is selected to accommodate popup
                            const paddingOptions = {
                                paddingTopLeft: L.point(50, popupHeight + 50), // popup height plus some extra space
                                paddingBottomRight: L.point(50, 50)
                            };
                            mapInstance.fitBounds(bounds, paddingOptions);
                        }, 100); // Short delay to ensure popup is rendered
                    }
                } else {
                    const paddingOptions = {
                        paddingTopLeft: L.point(50, 50),
                        paddingBottomRight: L.point(50, 50)
                    };
                    mapInstance.fitBounds(bounds, paddingOptions);
                }
            }
        } else {
            // If no selection, reset to default view
            mapInstance.setView([-40.9, 175.232], 5);
            markerReferences.forEach(marker => {
                marker.setIcon(L.Icon.Default.prototype);
                marker.setZIndexOffset(Math.round(marker.getLatLng().lat)); // Use latitude as default z-index
                marker.closePopup();
                marker.setOpacity(100);
            });

        }
    });

    return selection;
}
