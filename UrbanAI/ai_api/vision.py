from ultralytics import YOLO

# Load YOLO model once when the API starts
model = YOLO("yolo26n.pt")


def analyze_image(image_path):
    results = model(image_path, verbose=False)

    detections = []

    for result in results:

        for box in result.boxes:

            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            class_name = result.names[class_id]

            detections.append({
                "object": class_name,
                "confidence": round(confidence * 100, 2)
            })

    return detections