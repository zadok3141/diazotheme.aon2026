"""Utility functions for the AON 2026 theme.

This module provides helper functions:
- embed_url: Converts YouTube URLs to embed format with XSS protection
- strip_paragraphs: Removes paragraph tags from rich text content
"""

from urllib.parse import parse_qs
from urllib.parse import urlparse

import html


def embed_url(url):
    if url is None:
        return ""
    u = urlparse(url)
    qs = parse_qs(u.query)
    if "v" in qs:
        # Escape the video ID to prevent XSS
        video_id = html.escape(qs["v"][0])
        return "https://www.youtube.com/embed/%s?feature=oembed" % video_id
    else:
        # Escape the path to prevent XSS
        safe_path = html.escape(u.path)
        return "https://www.youtube.com/embed%s?feature=oembed" % safe_path


def strip_paragraphs(title):
    if title is None:
        return ""
    return title.replace("<p>", "").replace("</p>", "").strip()
