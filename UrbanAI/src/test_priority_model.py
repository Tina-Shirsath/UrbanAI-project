import joblib

# Load trained priority model
model = joblib.load("models/priority_model.pkl")

while True:
    complaint = input("\nEnter complaint (type 'exit' to stop): ")

    if complaint.lower() == "exit":
        break

    prediction = model.predict([complaint])[0]

    probabilities = model.predict_proba([complaint])[0]
    confidence = max(probabilities)

    print("\nAI Priority Analysis")
    print("--------------------")
    print("Priority:", prediction)
    print("Confidence:", round(confidence * 100, 2), "%")