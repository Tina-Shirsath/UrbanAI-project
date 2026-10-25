
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
from werkzeug.utils import secure_filename
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# --------------------------------------------------
# EXISTING TEXT MODEL PATHS
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "models")

complaint_model = joblib.load(
    os.path.join(MODEL_DIR, "complaint_classifier.pkl")
)
severity_model = joblib.load(
    os.path.join(MODEL_DIR, "severity_model.pkl")
)
priority_model = joblib.load(
    os.path.join(MODEL_DIR, "priority_model.pkl")
)

print("UrbanAI text models loaded successfully!")

# --------------------------------------------------
# YOLO IMAGE MODEL
# --------------------------------------------------

YOLO_MODEL_PATH = os.path.join(
    BASE_DIR,
    "road_damage_model",
    "runs",
    "detect",
    "runs",
    "detect",
    "road_damage_test_v2-2",
    "weights",
    "last.pt"
)

# BASE_DIR is the UrbanAI folder.
# Load the trained model only if its checkpoint exists.
image_model = None

if os.path.isfile(YOLO_MODEL_PATH):
    image_model = YOLO(YOLO_MODEL_PATH)
    print("UrbanAI YOLO model loaded successfully!")
else:
    print("WARNING: YOLO checkpoint not found:", YOLO_MODEL_PATH)

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

DEPARTMENT_MAP = {
    "pothole": "Road Department",
    "road_damage": "Road Department",
    "garbage": "Waste Management Department",
    "streetlight": "Electrical Department",
    "water_leakage": "Water Supply Department",
    "drainage": "Drainage Department"
}


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


# --------------------------------------------------
# TEXT PREDICTION - EXISTING ENDPOINT PRESERVED
# --------------------------------------------------

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True) or {}
        description = data.get("description", "").strip()

        if not description:
            return jsonify({
                "success": False,
                "message": "Description is required"
            }), 400

        category = str(complaint_model.predict([description])[0])

        confidence = 0
        if hasattr(complaint_model, "predict_proba"):
            probabilities = complaint_model.predict_proba([description])[0]
            confidence = round(float(max(probabilities)) * 100, 2)

        severity = str(severity_model.predict([description])[0])
        priority = str(priority_model.predict([description])[0])
        department = DEPARTMENT_MAP.get(category, "General Department")

        result = {
            "success": True,
            "category": category,
            "severity": severity,
            "priority": priority,
            "department": department,
            "confidence": confidence
        }

        print("Text prediction:", result)
        return jsonify(result)

    except Exception as error:
        print("AI prediction error:", str(error))
        return jsonify({
            "success": False,
            "message": "AI prediction failed",
            "error": str(error)
        }), 500


# --------------------------------------------------
# IMAGE PREDICTION - YOLO
# --------------------------------------------------

@app.route("/predict-image", methods=["POST"])
def predict_image():
    if image_model is None:
        return jsonify({
            "success": False,
            "message": "YOLO model checkpoint is unavailable."
        }), 503

    if "image" not in request.files:
        return jsonify({
            "success": False,
            "message": "Upload an image using the 'image' field."
        }), 400

    uploaded_file = request.files["image"]

    if not uploaded_file.filename:
        return jsonify({
            "success": False,
            "message": "No image selected."
        }), 400

    if not allowed_file(uploaded_file.filename):
        return jsonify({
            "success": False,
            "message": "Supported formats: JPG, JPEG, PNG, WEBP."
        }), 400

    temp_path = None

    try:
        import tempfile

        extension = uploaded_file.filename.rsplit(".", 1)[1].lower()

        with tempfile.NamedTemporaryFile(
            suffix="." + extension, delete=False
        ) as temp_file:
            temp_path = temp_file.name
            uploaded_file.save(temp_path)

        # Experimental model: predictions must be validated.
        results = image_model.predict(
            source=temp_path,
            imgsz=320,
            conf=0.10,
            verbose=False
        )

        detections = []

        for box in results[0].boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            coordinates = [
                round(float(value), 2)
                for value in box.xyxy[0].tolist()
            ]

            detections.append({
                "class_id": class_id,
                "class_name": image_model.names[class_id],
                "confidence": round(confidence * 100, 2),
                "box": coordinates
            })

        response = {
            "success": True,
            "model_status": "experimental",
            "detection_count": len(detections),
            "detections": detections,
            "message": (
                "Predictions are experimental and may be inaccurate."
            )
        }

        print("Image prediction:", response)
        return jsonify(response)

    except Exception as error:
        print("Image prediction error:", str(error))
        return jsonify({
            "success": False,
            "message": "Image prediction failed",
            "error": str(error)
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "success": True,
        "message": "UrbanAI AI API is running!",
        "text_prediction": True,
        "image_prediction": image_model is not None
    })


# --------------------------------------------------
# START SERVER
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=False
    )