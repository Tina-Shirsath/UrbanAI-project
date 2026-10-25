import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report


# Load priority dataset
data = pd.read_csv("data/priority.csv")

X = data["text"]
y = data["priority"]


# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)


# Create ML pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2)
    )),

    ("classifier", LogisticRegression(
        max_iter=1000
    ))
])


# Train model
model.fit(X_train, y_train)


# Test model
predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("Priority Model Accuracy:", accuracy)
print()
print(classification_report(y_test, predictions))


# Save model
joblib.dump(model, "models/priority_model.pkl")

print("Priority model saved successfully!")