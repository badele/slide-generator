#!/usr/bin/env bash

# Mosaic generated with 'montage profiles/*/*.png -geometry x150+2+2 -background black +label mosaique.png'

echo $*

# Default value
OUTPUT_SIZE="${OUTPUT_SIZE:-1200x675}"
BACKGROUND_COLOR="${BACKGROUND_COLOR:-none}"

TEXT_EFFECTS_BEFORE="${TEXT_EFFECTS_BEFORE:-}"
TEXT_BG="${TEXT_BG:-none}"
TEXT_FG="${TEXT_FG:-#FFFFFF}"
TEXT_FONT_STYLE="${TEXT_FONT_STYLE:-NEXTART-Heavy}"
TEXT_FONT_SIZE="${TEXT_FONT_SIZE:-64}"
TEXT_EFFECTS_AFTER="${TEXT_EFFECTS_AFTER:--trim}"
TEXT_GEOMETRY="+0+0"
TEXT_GRAVITY="${TEXT_GRAVITY:-center}"
TEXT_COMPOSITIONS="${TEXT_COMPOSITIONS:--compose over -composite}"

IMG_EFFECTS_BEFORE="${IMG_EFFECTS_BEFORE:-}"
IMG_BG="${IMG_BG:-none}"
IMG_EFFECTS_AFTER="${IMG_EFFECTS_AFTER:-}"
IMG_GEOMETRY="+0+0"
IMG_GRAVITY="${IMG_GRAVITY:-northwest}"
IMG_EFFECTS="${IMG_EFFECTS:-}"
IMG_COMPOSITIONS="${IMG_COMPOSITIONS:--compose over -composite}"

show_help() {
  cat <<EOF
Usage: $0 --profile PROFILE [--set VAR=VALUE ...]

Options:
  --gen-profile        Generate minimal profile 
  --profile PROFILE    Charger un profil depuis le dossier profiles/ (requis)
  --set VAR=VALUE      Définir/surcharger une variable (ex: --set TEXT3="Mon titre")
  --help               Afficher cette aide

Exemples:
  $0 --profile devops_blue_background --set TEXT3="Mon titre"
  $0 --profile devops_img_background --set BACKGROUND_IMG="image.jpg" --set TEXT4="Description"
EOF
}

gen_profile() {
  cat <<EOF >profiles/minimal/config
  #  vim: set ft=bash :

  # list available font
  # magick -list font

  ###########################################################################
  # Default values
  ###########################################################################
  
  OUTPUT_SIZE="${OUTPUT_SIZE}"
  BACKGROUND_COLOR="${BACKGROUND_COLOR}"

  ###########################################################################
  # Text default values
  ###########################################################################
  
  TEXT_EFFECTS_BEFORE="${TEXT_EFFECTS_BEFORE}"
  # Add settings, before (background, font, pointsize, fill, caption)

  TEXT_BG="${TEXT_BG}"
  # Define 'background' color for text

  TEXT_FG="${TEXT_FG}"
  # Define 'fill' color for text

  TEXT_FONT_STYLE="${TEXT_FONT_STYLE}"
  # Define 'font' for text

  TEXT_FONT_SIZE="${TEXT_FONT_SIZE}"
  # Define 'pointsize' for text

  TEXT_EFFECTS_AFTER="${TEXT_EFFECTS_AFTER}"
  # Add settings, after (background, font, pointsize, fill, caption)

  TEXT_GEOMETRY="${TEXT_GEOMETRY}"
  TEXT_GRAVITY="${TEXT_GRAVITY}"
  TEXT_COMPOSITION="${TEXT_COMPOSITIONS}"

  ###########################################################################
  # Img default values
  ###########################################################################
  
  IMG_EFFECTS_BEFORE="${IMG_EFFECTS_BEFORE}"
  IMG_BG="${IMG_BG}"
  IMG_EFFECTS_AFTER="${IMG_EFFECTS_AFTER}"
  IMG_GEOMETRY="${IMG_GEOMETRY}"
  IMG_GRAVITY="${IMG_GRAVITY}"
  IMG_COMPOSITION="${IMG_COMPOSITIONS}"
EOF
}

profile_loaded=false

# arguments parsing
while [[ $# -gt 0 ]]; do
  case $1 in
  --profile)
    if [[ -z "$2" ]]; then
      echo "Erreur: --profile nécessite un argument"
      exit 1
    fi
    profile_file="profiles/$2/config"
    if [[ ! -f "$profile_file" ]]; then
      echo "Erreur: Profil '$profile_file' introuvable"
      exit 1
    fi
    source "$profile_file"
    profile_loaded=true
    shift 2
    ;;
  --set)
    if [[ -z "$2" ]]; then
      echo "Erreur: --set nécessite un argument VAR=VALUE"
      exit 1
    fi
    if [[ ! "$2" =~ ^[A-Z_][A-Z0-9_]*=.* ]]; then
      echo "Erreur: Format attendu pour --set: VAR=VALUE"
      exit 1
    fi
    export "$2"
    shift 2
    ;;
  --gen-profile | -g)
    gen_profile
    exit 0
    ;;
  --help | -h)
    show_help
    exit 0
    ;;
  *)
    echo "Unknow option: $1"
    show_help
    exit 1
    ;;
  esac
done

if [[ "$profile_loaded" != "true" ]]; then
  echo "Erreur: Option --profile is required"
  show_help
  exit 1
fi

HASSVG=false
cmd="'(' -size ${OUTPUT_SIZE} xc:${BACKGROUND_COLOR} ')'"
if [ -n "$BACKGROUND_IMG" ]; then
  # Vérifier si l'image de fond est un SVG
  if [[ "$BACKGROUND_IMG" =~ \.svg$ ]]; then
    HASSVG=true
    # Créer une copie temporaire du SVG pour faire les substitutions
    temp_svg="temp_background.svg"
    if [[ "$BACKGROUND_IMG" =~ ^https?:// ]]; then
      # Télécharger le fichier si c'est une URL
      curl -s -o "$temp_svg" "$BACKGROUND_IMG"
    else
      # Copier le fichier local
      cp "$BACKGROUND_IMG" "$temp_svg"
    fi

    # Substituer toutes les variables dans le SVG
    for var_name in $(env | grep -E '^(TEXT|BACKGROUND_|FONT_|IMG)[0-9]*(_.*)?=' | cut -d= -f1); do
      var_value="${!var_name}"
      if [ -n "$var_value" ]; then
        sed -i "s|BEGIN${var_name}.*END${var_name}|${var_value}|g" "$temp_svg"
        echo sed -i "s|BEGIN${var_name}.*END${var_name}|${var_value}|g" "$temp_svg"
      fi
    done

    # Convertir le SVG modifié en PNG
    magick "$temp_svg" -resize "$OUTPUT_SIZE" background.png
    # rm "$temp_svg"
  else
    magick "$BACKGROUND_IMG" \
      -resize "${OUTPUT_SIZE}^" \
      -gravity center \
      -extent "$OUTPUT_SIZE" \
      background.png
  fi

  cmd="'(' -size ${OUTPUT_SIZE} background.png ')'"
fi

# Read profile variables
index=1
while [[ $HASSVG == false && $index -le 100 ]]; do
  #############################################################################
  # Text
  #############################################################################
  text_var="TEXT${index}"

  text_value="${!text_var}"

  if [ -n "$text_value" ]; then
    effects_before_var="TEXT${index}_EFFECTS_BEFORE"
    bg_var="TEXT${index}_BG"
    fg_var="TEXT${index}_FG"
    font_var="TEXT${index}_FONT_STYLE"
    size_var="TEXT${index}_FONT_SIZE"
    effects_after_var="TEXT${index}_EFFECTS_AFTER"
    pos_var="TEXT${index}_GEOMETRY"
    gravity_var="TEXT${index}_GRAVITY"
    compositions_var="TEXT${index}_COMPOSITIONS"

    text_effects_before="${!effects_before_var:-$TEXT_EFFECTS_BEFORE}"
    text_bg="${!bg_var:-$TEXT_BG}"
    text_fg="${!fg_var:-$TEXT_FG}"
    font_style="${!font_var:-$TEXT_FONT_STYLE}"
    font_size="${!size_var:-$TEXT_FONT_SIZE}"
    text_effects_after="${!effects_after_var:-$TEXT_EFFECTS_AFTER}"
    text_geometry="${!pos_var:-$TEXT_GEOMETRY}"
    text_gravity="${!gravity_var:-$TEXT_GRAVITY}"
    text_compositions="${!compositions_var:-$TEXT_COMPOSITIONS}"

    # Create imagemagick command
    cmd="${cmd} '('"
    [[ -n "$text_effects_before" ]] && cmd="${cmd} $text_effects_before"

    [[ -n "$text_bg" ]] && cmd="${cmd} -background '$text_bg'"
    [[ -n "$font_style" ]] && cmd="${cmd} -font '$font_style'"
    [[ -n "$font_size" ]] && cmd="${cmd} -pointsize '$font_size'"
    [[ -n "$text_fg" ]] && cmd="${cmd} -fill '$text_fg'"
    cmd="${cmd} caption:\"$text_value\""

    [[ -n "$text_effects_after" ]] && cmd="${cmd} $text_effects_after"

    cmd="$cmd ')' -gravity ${text_gravity}"
    [[ -n "$text_geometry" ]] && cmd="${cmd} -geometry '$text_geometry'"

    # Add optional compositions
    [[ -n "$text_compositions" ]] && cmd="${cmd} $text_compositions"

    # Store the last text gravity
    TEXT_GRAVITY="$text_gravity"
  fi

  #############################################################################
  # IMG
  #############################################################################
  img_var="IMG${index}"

  img_value="${!img_var}"
  if [ -n "$img_value" ]; then

    effects_before_var="IMG${index}_EFFECTS_BEFORE"
    bg_var="IMG${index}_BG"
    effects_after_var="IMG${index}_EFFECTS_AFTER"
    geometry_var="IMG${index}_GEOMETRY"
    grav_var="IMG${index}_GRAVITY"
    compositions_var="IMG${index}_COMPOSITIONS"

    img_effects_before="${!effects_before_var:-$IMG_EFFECTS_BEFORE}"
    img_bg="${!bg_var:-$IMG_BG}"
    img_effects_after="${!effects_after_var:-$IMG_EFFECTS_AFTER}"
    img_geometry="${!geometry_var:-$IMG_GEOMETRY}"
    img_gravity="${!grav_var:-$IMG_GRAVITY}"
    img_compositions="${!compositions_var:-$IMG_COMPOSITIONS}"

    # Create imagemagick command
    cmd="${cmd} '('"
    [[ -n "$img_effects_before" ]] && cmd="${cmd} $img_effects_before"
    [[ -n "$img_bg" ]] && cmd="${cmd} -background '$img_bg'"
    [[ -n "$img_effects_after" ]] && cmd="${cmd} $img_effects_after"
    cmd="${cmd} ${img_value}"

    cmd="$cmd ')' -gravity ${img_gravity}"
    [[ -n "$img_geometry" ]] && cmd="${cmd} -geometry '$img_geometry'"

    # Add optional compositions
    [[ -n "$img_compositions" ]] && cmd="${cmd} $img_compositions"
  fi

  #############################################################################
  # Imagemagick command
  #############################################################################
  command_var="COMMAND${index}"

  command_value="${!command_var}"

  if [ -n "$command_value" ]; then
    cmd="${cmd} ${command_value}"
  fi

  index=$((index + 1))
done

# Output
eval "magick ${cmd} output.png"
echo "magick ${cmd} output.png"

if [ -n "$POST_PROCESSING" ]; then
  eval "$POST_PROCESSING"
fi
