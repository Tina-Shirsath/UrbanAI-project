import joblib

# Load trained model
model = joblib.load("models/complaint_classifier.pkl")

while True:
    complaint = input("\nEnter complaint (type 'exit' to stop): ")

    if complaint.lower() == "exit":
        break

    prediction = model.predict([complaint])[0]
    probabilities = model.predict_proba([complaint])[0]
    confidence = max(probabilities)

    print("\nAI Analysis")
    print("--------------------")
    print("Category:", prediction)
    print("Confidence:", round(confidence * 100, 2), "%")