#!/usr/bin/env just -f

set export

# This help
@help:
    just -l -u

###############################################################################
# Dev
###############################################################################

# Install dependencies
[group('dev')]
@install:
    npm install

# Download fonts from Google Fonts (cached — only downloads missing files)
[group('dev')]
@load-fonts:
    npm run load-fonts

# Start development server (loads fonts first)
[group('dev')]
dev: load-fonts
    @npm run dev

# Build for production (loads fonts first)
[group('dev')]
build: load-fonts
    @npm run build

# Run tests
[group('dev')]
@test:
    npm test

# Generate a slide via CLI (ex: just generate simple title="Hello" subtitle="World")
[group('dev')]
generate TEMPLATE="simple" *ARGS="":
    #!/usr/bin/env bash
    PARAMS=""
    for arg in {{ ARGS }}; do
        PARAMS="$PARAMS --set $arg"
    done
    npx tsx src/cli.ts generate --template {{ TEMPLATE }} $PARAMS --output output.png
    echo "→ output.png"

###############################################################################
# Docker
###############################################################################

# Démarrer le service en arrière-plan
[group('docker')]
@start:
    docker compose up --build -d
    echo ""
    echo "Slide Generator démarré."
    echo ""
    echo "  Playground  →  http://localhost:3000"
    echo "  API         →  http://localhost:3000/api/generate?template=simple&title=Hello"
    echo "  Templates   →  http://localhost:3000/api/templates"
    echo ""
    echo "Logs : just logs"
    echo "Stop : just stop"

# Arrêter le service
[group('docker')]
@stop:
    docker compose down

# Redémarrer le service
[group('docker')]
@restart:
    just stop
    just start

# Reconstruire l'image et redémarrer
[group('docker')]
rebuild SERVICE="":
    #!/usr/bin/env bash
    if [ -n "$SERVICE" ]; then
        docker compose up --build -d "$SERVICE"
    else
        docker compose down
        docker compose up --build -d
    fi

# Afficher les logs (ex: just logs  ou  just logs slide-generator)
[group('docker')]
logs SERVICE="":
    #!/usr/bin/env bash
    if [ -n "$SERVICE" ]; then
        docker compose logs -f "$SERVICE"
    else
        docker compose logs -f
    fi

# Statut des containers
[group('docker')]
@status:
    docker compose ps

# Alias court pour status
[group('docker')]
@ps:
    docker compose ps

###############################################################################
# CI / Utils
###############################################################################

# Compare deux images (utile quand un test échoue)
@compare SRC DST OUTPUT="difference.png":
    compare -metric RMSE "{{ SRC }}" "{{ DST }}" {{ OUTPUT }} | sed 's/^\(.*\)$/\1/' || true

# Mettre à jour ALL_SAMPLES.md avec les samples de tous les profils
[group('ci')]
update-samples:
    #!/usr/bin/env bash
    echo "# All Profile Samples" > ALL_SAMPLES.md
    echo "" >> ALL_SAMPLES.md
    echo "This file contains all sample images from all profiles." >> ALL_SAMPLES.md
    echo "" >> ALL_SAMPLES.md

    for profile_dir in profiles/*/; do
        profile_name=$(basename "$profile_dir")
        samples=$(find "$profile_dir" -name "sample*.png" | sort)

        if [ -n "$samples" ]; then
            echo "## $profile_name" >> ALL_SAMPLES.md
            echo "" >> ALL_SAMPLES.md

            for sample in $samples; do
                sample_name=$(basename "$sample")
                echo "![${profile_name} - ${sample_name}]($sample)" >> ALL_SAMPLES.md
                echo "" >> ALL_SAMPLES.md
            done
        fi
    done
