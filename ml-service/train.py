"""
Training script for InterviewAI Emotion CNN on FER2013 dataset.

Usage:
  1. Download FER2013 from https://www.kaggle.com/datasets/msambare/fer2013
  2. Extract to ./data/fer2013/ with subdirectories: train/ and test/
     Each subdirectory should have folders: angry, disgust, fear, happy, sad, surprise, neutral
  3. Run: python train.py

The trained model will be saved to ./models/emotion_cnn.pth
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from model import EmotionCNN

# ── Config ──────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "fer2013")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
BATCH_SIZE = 64
EPOCHS = 50
LR = 0.001
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
NUM_CLASSES = 7

os.makedirs(MODEL_DIR, exist_ok=True)


def get_transforms():
    train_tf = transforms.Compose([
        transforms.Grayscale(num_output_channels=1),
        transforms.Resize((48, 48)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.RandomAffine(0, translate=(0.1, 0.1)),
        transforms.ToTensor(),
        transforms.Normalize([0.5], [0.5]),
    ])
    test_tf = transforms.Compose([
        transforms.Grayscale(num_output_channels=1),
        transforms.Resize((48, 48)),
        transforms.ToTensor(),
        transforms.Normalize([0.5], [0.5]),
    ])
    return train_tf, test_tf


def train():
    print(f"🚀 Training on {DEVICE}")
    print(f"📁 Dataset: {DATA_DIR}")

    train_tf, test_tf = get_transforms()

    train_dir = os.path.join(DATA_DIR, "train")
    test_dir = os.path.join(DATA_DIR, "test")

    if not os.path.exists(train_dir):
        print(f"❌ Training data not found at {train_dir}")
        print("   Download FER2013 from: https://www.kaggle.com/datasets/msambare/fer2013")
        print("   Extract to: ./data/fer2013/train/ and ./data/fer2013/test/")
        return

    train_dataset = datasets.ImageFolder(train_dir, transform=train_tf)
    test_dataset = datasets.ImageFolder(test_dir, transform=test_tf)

    print(f"📊 Training samples: {len(train_dataset)}")
    print(f"📊 Test samples: {len(test_dataset)}")
    print(f"📊 Classes: {train_dataset.classes}")

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, pin_memory=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0, pin_memory=True)

    model = EmotionCNN(num_classes=NUM_CLASSES).to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.5, patience=5)

    best_acc = 0.0

    for epoch in range(1, EPOCHS + 1):
        # Train
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()

        train_loss = running_loss / total
        train_acc = 100.0 * correct / total

        # Evaluate
        model.eval()
        test_correct = 0
        test_total = 0

        with torch.no_grad():
            for images, labels in test_loader:
                images, labels = images.to(DEVICE), labels.to(DEVICE)
                outputs = model(images)
                _, predicted = outputs.max(1)
                test_total += labels.size(0)
                test_correct += predicted.eq(labels).sum().item()

        test_acc = 100.0 * test_correct / test_total
        scheduler.step(test_acc)

        print(f"Epoch {epoch:3d}/{EPOCHS} | Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | Test Acc: {test_acc:.2f}%")

        if test_acc > best_acc:
            best_acc = test_acc
            save_path = os.path.join(MODEL_DIR, "emotion_cnn.pth")
            torch.save(model.state_dict(), save_path)
            print(f"  💾 Saved best model ({best_acc:.2f}%)")

    print(f"\n✅ Training complete! Best test accuracy: {best_acc:.2f}%")
    print(f"   Model saved to: {os.path.join(MODEL_DIR, 'emotion_cnn.pth')}")


if __name__ == "__main__":
    train()
