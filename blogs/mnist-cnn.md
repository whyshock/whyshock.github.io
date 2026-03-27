# When 99% Accuracy Means 1% Confusion

The MNIST dataset is legendary in machine learning. Handwritten digits. 70,000 images. Simple, clean, solved so thoroughly that it's almost a cliché.

But that cliché hides something important. When you look at MNIST failures—the 1% of images a well-trained network misclassifies—something interesting happens.

These failures often look correct to the network and incorrect to humans. A 4 that looks like a 9 to a neural network but is obviously a 4 to us. A 7 that the network reads as a 1 but we recognize instantly.

This wasn't a failure of my CNN architecture. It was revealing something about what the network learned versus what we see.

The network learns: "which pixel patterns correlate with which digit labels?" It learns from data—pixels plus labels. But data has ambiguities. Some writing is ambiguous. Some labels might be wrong. Some variation isn't in the training set.

Early in training, the network is uncertain. Confidence scores are spread across multiple classes. As it trains, confidence sharpens. By convergence, it's very confident. But confidence doesn't equal accuracy.

```
Training Progression
    ├─ Epoch 1: Uncertain, many errors, low confidence
    ├─ Epoch 50: More confident, fewer errors
    └─ Epoch 100: Very confident, occasional errors
    
Concern: Final errors are confidently wrong
```

The real insight came when I looked at misclassified examples. The network was at 99% accuracy, but the misclassifications weren't random. They were systematic. Certain digits were confused with certain other digits. 4 vs 9. 3 vs 5. Digits that share features.

This is actually a good sign. The network wasn't randomly guessing. It was generalizing—learning shared structure between digit classes. Its errors reflected the visual ambiguity between digits.

But this also meant: the network can't be trusted to be honest about uncertainty on ambiguous samples. A truly uncertain case and a confident wrong answer look the same from the outside—both produce a label and confidence score.

This problem scales. MNIST is toy data—controlled, simple. Real-world digit recognition (reading checks, postal codes, etc.) has variation. Handwriting varies wildly. Some digits are smudged, skewed, incomplete. The network trained on MNIST will fail.

And it will fail confidently.

Here's what I learned from implementing learning rate scheduling: adjusting how much the network changes during training has enormous impact. A learning rate too high and the network overshoots optimal parameters. Too low and it converges slowly or gets stuck.

Learning rate scheduling reduces the rate over time. Learn aggressively at first (explore the space), then refine carefully (converge to good parameters).

But this is different from confidence. A network can be overfit and still confidently wrong. A network can be well-regularized and still fail on out-of-distribution examples.

```
Confidence vs Accuracy
    ├─ High confidence, high accuracy: Good
    ├─ Low confidence, high accuracy: Honest uncertainty
    ├─ High confidence, low accuracy: Dangerous
    └─ Low confidence, low accuracy: Useless
```

Real-world deployment mostly gives you the dangerous quadrant. The model learned well on MNIST, sort of learned on real handwriting, but doesn't know it. Confidence stays high even on images far from training distribution.

This is why uncertainty estimation is an open problem in deep learning. You want models that admit when they don't know. Models that say "this looks unusual, I'm less confident." We don't have good methods for this built-in.

What kept me thinking: MNIST has been solved for years. We have models with 99.7% accuracy. But that remaining 0.3% is interesting. Are they actually ambiguous digits? Mislabeled data? Or edge cases the network should have learned?

More importantly: if MNIST is solved, why do real-world digit recognition still fail? Because MNIST isn't the problem. Handwriting variation is. And that's a problem that doesn't have a dataset—it has infinite variation.

---

*If a network achieves 99% accuracy on MNIST but fails on real handwriting, did it solve the problem or solve the dataset?*

## Outputs

Notebook output snapshots:

![Output 1: output 04 1](images/output_04_1.png)

![Output 2: output 07 1](images/output_07_1.png)

![Output 3: output 14 1](images/output_14_1.png)

![Output 4: output 19 0](images/output_19_0.png)

![Output 5: output 22 0](images/output_22_0.png)
