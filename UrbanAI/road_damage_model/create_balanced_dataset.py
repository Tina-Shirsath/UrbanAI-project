from pathlib import Path
from collections import defaultdict
import random
import shutil

# ==============================
# SETTINGS
# ==============================

SOURCE_IMAGES = Path("dataset/images/train")
SOURCE_LABELS = Path("dataset/labels/train")

OUTPUT_IMAGES = Path("dataset_small/images/train")
OUTPUT_LABELS = Path("dataset_small/labels/train")

CLASSES = [0, 1, 2, 3, 4]

# Target number of images containing each class
TARGET_PER_CLASS = 1000

RANDOM_SEED = 42

random.seed(RANDOM_SEED)


# ==============================
# CREATE OUTPUT DIRECTORIES
# ==============================

OUTPUT_IMAGES.mkdir(parents=True, exist_ok=True)
OUTPUT_LABELS.mkdir(parents=True, exist_ok=True)


# ==============================
# GROUP IMAGES BY CLASS
# ==============================

class_images = defaultdict(set)

label_files = list(SOURCE_LABELS.glob("*.txt"))

print("Reading labels...")
print("Total label files:", len(label_files))


for label_file in label_files:

    classes_in_image = set()

    for line in label_file.read_text().splitlines():

        if not line.strip():
            continue

        class_id = int(line.split()[0])
        classes_in_image.add(class_id)

    for class_id in classes_in_image:

        if class_id in CLASSES:
            class_images[class_id].add(label_file.stem)


# ==============================
# PRINT DISTRIBUTION
# ==============================

print("\nAvailable images per class:")

for class_id in CLASSES:

    print(
        f"Class {class_id}: "
        f"{len(class_images[class_id])} images"
    )


# ==============================
# SELECT BALANCED IMAGES
# ==============================

selected = set()

# Randomize each class list
for class_id in CLASSES:

    images = list(class_images[class_id])

    random.shuffle(images)

    count = 0

    for image_name in images:

        if count >= TARGET_PER_CLASS:
            break

        if image_name not in selected:

            selected.add(image_name)
            count += 1

print("\nSelected images:", len(selected))


# ==============================
# COPY IMAGES + LABELS
# ==============================

print("\nCopying files...")

copied = 0
missing = 0

for image_name in selected:

    label_file = SOURCE_LABELS / f"{image_name}.txt"

    # Try common image extensions
    image_file = None

    for extension in [".jpg", ".jpeg", ".png"]:

        candidate = SOURCE_IMAGES / f"{image_name}{extension}"

        if candidate.exists():
            image_file = candidate
            break

    if image_file is None:

        missing += 1
        continue

    shutil.copy2(
        image_file,
        OUTPUT_IMAGES / image_file.name
    )

    shutil.copy2(
        label_file,
        OUTPUT_LABELS / label_file.name
    )

    copied += 1


# ==============================
# RESULT
# ==============================

print("\n==============================")
print("BALANCED DATASET CREATED")
print("==============================")

print("Images copied :", copied)
print("Missing images:", missing)

print("\nOutput:")
print("Images:", OUTPUT_IMAGES)
print("Labels:", OUTPUT_LABELS)