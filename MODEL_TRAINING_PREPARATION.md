# Model training preparation

Training was not started.

## What exists

There is no training program, notebook, dataset directory, model file, requirements file for Python machine learning, or training configuration in this project.

The web application does not load a model.

`backend/uploads/` contains one `.py` file that was uploaded through the document system. It is stored user content, not a training pipeline. It is included in the local upload backup and is excluded from Git. It was not reviewed as training code and no accuracy or dataset claim is made about it.

## What is missing before training can begin

- A dataset, and a decision about whether it can be published
- The expected file format and any preprocessing steps
- Training code or a notebook
- A Python environment and library versions
- A training command
- An output directory for model files
- A separate startup path so training is not part of `./docutrack.sh`

## Rule for later

Keep training files outside `./docutrack.sh`. Do not commit private or restricted datasets. Do not invent results before a real training run.
