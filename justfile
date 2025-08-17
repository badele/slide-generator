#!/usr/bin/env just -f

set export

# This help
@help:
    just -l -u

# Run all profiles tests
@test:
    ./run_tests.sh

# Compare image (when test fails)
@compare SRC DST:
    compare -metric RMSE "$SRC" "$DST" difference.png | sed 's/^\(.*\)$/\1/' || true

# Compute color tones
@tones:
    ./compute_tones.sh

