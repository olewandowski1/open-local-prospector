# Calculate Opportunity Scores Deterministically

Status: Accepted

AI runtimes will return schema-validated classifications, severities, confidences, and Supporting Observations, while versioned application code calculates the final 0–100 Opportunity Score. The initial weights are 40% opportunity severity, 25% evidence confidence, 15% contactability, 10% local decision-making likelihood, and 10% apparent commercial value; 60 is the initial Review Queue threshold. Subjective aesthetic preference is not evidence, category guidance may vary without changing weights, and review outcomes form an evaluation dataset but never modify the rubric automatically.
