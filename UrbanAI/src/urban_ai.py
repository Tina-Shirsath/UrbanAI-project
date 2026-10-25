import joblib


# Load all trained models
category_model = joblib.load("models/complaint_classifier.pkl")
severity_model = joblib.load("models/severity_model.pkl")
priority_model = joblib.load("models/priority_model.pkl")


def analyze_complaint(complaint):

    # Predict category
    category = category_model.predict([complaint])[0]

    # Predict severity
    severity = severity_model.predict([complaint])[0]

    # Predict priority
    priority = priority_model.predict([complaint])[0]

    return category, severity, priority


# Main program
while True:

    complaint = input("\nEnter complaint (type 'exit' to stop): ")

    if complaint.lower() == "exit":
        break

    category, severity, priority = analyze_complaint(complaint)

    print("\n================================")
    print("        URBANAI ANALYSIS")
    print("================================")

    print("Complaint :", complaint)
    print("Category  :", category)
    print("Severity  :", severity)
    print("Priority  :", priority)

    print("================================")