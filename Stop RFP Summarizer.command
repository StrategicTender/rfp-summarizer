#!/bin/bash
lsof -ti :8888 | xargs kill -9 2>/dev/null || true
osascript -e 'display notification "Stopped RFP Summarizer on 8888" with title "Strategic Tender"'
