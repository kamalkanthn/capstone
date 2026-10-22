"""Compact frame encoder plus bidirectional GRU for isolated dynamic signs."""

from __future__ import annotations

import torch
from torch import nn
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small


class MobileNetGRU(nn.Module):
    """Encode ordered RGB frames, then classify the temporal feature sequence."""

    def __init__(self, num_classes: int, pretrained: bool = True, hidden_size: int = 128) -> None:
        super().__init__()
        weights = MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        backbone = mobilenet_v3_small(weights=weights)
        self.features = backbone.features
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.temporal = nn.GRU(576, hidden_size, batch_first=True, bidirectional=True)
        self.dropout = nn.Dropout(0.35)
        self.classifier = nn.Linear(hidden_size * 2, num_classes)

    def forward(self, video: torch.Tensor) -> torch.Tensor:
        # video: batch x time x RGB x height x width
        batch, time, channels, height, width = video.shape
        frames = video.reshape(batch * time, channels, height, width)
        features = self.pool(self.features(frames)).flatten(1)
        sequence = features.reshape(batch, time, -1)
        _, hidden = self.temporal(sequence)
        pooled = torch.cat((hidden[-2], hidden[-1]), dim=1)
        return self.classifier(self.dropout(pooled))
