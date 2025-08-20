#!/usr/bin/env bash

# Script pour exécuter tous les tests unitaires des profils avec bats

set -e

echo "🧪 Lancement des tests unitaires pour tous les profils..."
echo ""

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier que bats est installé
if ! command -v bats &>/dev/null; then
    echo -e "${RED}❌ Erreur: bats n'est pas installé${NC}"
    echo "Installation:"
    echo "  - Ubuntu/Debian: sudo apt-get install bats"
    echo "  - macOS: brew install bats-core"
    echo "  - Ou depuis les sources: https://github.com/bats-core/bats-core"
    exit 1
fi

# Vérifier l'existence du fichier de test générique
if [[ ! -f "test_profiles.bats" ]]; then
    echo -e "${RED}❌ Erreur: Fichier test_profiles.bats introuvable${NC}"
    echo "Assurez-vous d'exécuter ce script depuis la racine du projet."
    exit 1
fi

echo -e "${YELLOW}🔍 Exécution des tests génériques pour tous les profils${NC}"
echo "   Fichier: test_profiles.bats"
echo ""

# Exécuter les tests génériques
if bats --show-output-of-passing-tests test_profiles.bats; then
    echo ""
    echo "=================================================="
    echo -e "${GREEN}✅ Tous les tests sont passés avec succès!${NC}"
    echo "=================================================="
    exit 0
else
    echo ""
    echo "=================================================="
    echo -e "${RED}❌ Certains tests ont échoué!${NC}"
    echo "=================================================="
    exit 1

fi
