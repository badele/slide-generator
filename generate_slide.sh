#!/usr/bin/env bash

# Fonction pour obtenir le chemin de la police
getfontpath() {
  echo "/home/badele/.local/share/fonts/NEXT ART_$1.otf"
}

# Valeurs par défaut globales
BACKGROUND_SIZE="${BACKGROUND_SIZE:-1200x675}"
TEXT_BG="${TEXT_BG:-#10436200}"
TEXT_FG="${TEXT_FG:-#FFFFFF}"
FONT_STYLE="${FONT_STYLE:-Heavy}"
FONT_SIZE="${FONT_SIZE:-32}"

# Valeurs par défaut pour la taille
BACKGROUND_SIZE="${BACKGROUND_SIZE:-1200x675}"

if [ -n "$BACKGROUND_COLOR" ]; then
  magick -size "$BACKGROUND_SIZE" canvas:"$BACKGROUND_COLOR" background.png
elif [ -n "$BACKGROUND_IMG" ]; then
  magick "$BACKGROUND_IMG" \
    -resize "${BACKGROUND_SIZE}^" \
    -gravity center \
    -extent "$BACKGROUND_SIZE" \
    background.png
else
  exit 1
fi

# Base de commande
cmd=("background.png")

# Boucle sur les textes
index=1
while true; do
  text_var="TEXT${index}"

  # Si pas de texte, on arrête
  text_value="${!text_var}"
  if [ -z "$text_value" ]; then
    break
  fi

  # Chercher les options spécifiques ou fallback vers global
  bg_var="TEXT${index}_BG"
  fg_var="TEXT${index}_FG"
  font_var="TEXT${index}_FONT_STYLE"
  size_var="TEXT${index}_FONT_SIZE"
  pos_var="TEXT${index}_POSITION"

  text_bg="${!bg_var:-$TEXT_BG}"
  text_fg="${!fg_var:-$TEXT_FG}"
  font_style="${!font_var:-$FONT_STYLE}"
  font_size="${!size_var:-$FONT_SIZE}"
  text_pos="${!pos_var:-+30+30}"

  # Ajout dans la commande magick
  cmd+=(
    \( -background "$text_bg" -fill "$text_fg" -font "$(getfontpath "$font_style")" -pointsize "$font_size" label:"$text_value" \)
    -gravity northwest -geometry "$text_pos" -composite
  )

  # Prochain texte
  index=$((index + 1))
done

index=1
while true; do
  img_var="IMG${index}"
  img_value="${!img_var}"

  # Si pas d'image, on arrête
  if [ -z "$img_value" ]; then
    break
  fi

  # Chercher les options spécifiques ou fallback
  pos_var="IMG${index}_POSITION"
  grav_var="IMG${index}_GRAVITY"

  img_pos="${!pos_var:-+0+0}"
  img_gravity="${!grav_var:-northwest}"

  # Si taille spécifiée, resize avant d'insérer
  cmd+=(
    \( "$img_value" \)
    -gravity "$img_gravity" -geometry "$img_pos" -composite
  )

  index=$((index + 1))
done

# Générer le fichier final
magick "${cmd[@]}" output.png
