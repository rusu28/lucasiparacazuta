from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "education" / "powerpoint" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

BG = "#101318"
PANEL = "#151a22"
TEXT = "#f5f7fb"
MUTED = "#aeb7c8"
BLUE = "#3b82f6"
GREEN = "#22c55e"
YELLOW = "#eab308"
VIOLET = "#a855f7"
ORANGE = "#f97316"
TEAL = "#14b8a6"


def style_ax(ax: plt.Axes) -> None:
    ax.set_facecolor(PANEL)
    ax.tick_params(colors=MUTED, labelsize=9)
    for spine in ax.spines.values():
        spine.set_color("#2a3240")
    ax.grid(axis="y", color="#2a3240", linewidth=0.8)


def save(fig: plt.Figure, name: str) -> None:
    fig.savefig(OUT / name, dpi=180, bbox_inches="tight", facecolor=BG)
    plt.close(fig)


def edtech_market() -> None:
    years = [2021, 2027]
    values = [254.8, 605.4]
    fig, ax = plt.subplots(figsize=(8.6, 4.8), facecolor=BG)
    style_ax(ax)
    ax.plot(years, values, color=BLUE, linewidth=4, marker="o", markersize=10)
    ax.fill_between(years, values, [0, 0], color=BLUE, alpha=0.13)
    ax.set_title("Piata globala EdTech", color=TEXT, fontsize=18, weight="bold", pad=14)
    ax.set_ylabel("miliarde USD", color=MUTED)
    ax.set_xticks(years)
    ax.set_ylim(0, 680)
    for x, y in zip(years, values):
        ax.text(x, y + 28, f"{y:.1f} mld. $", color=TEXT, ha="center", fontsize=11, weight="bold")
    ax.text(2024, 90, "CAGR raportat: ~15,5%", color=GREEN, ha="center", fontsize=12, weight="bold")
    fig.text(
        0.02,
        0.02,
        "Sursa: ReportLinker / GlobeNewswire, EdTech Market Outlook 2022-2027",
        color=MUTED,
        fontsize=8,
    )
    save(fig, "edtech-market.png")


def gamification() -> None:
    labels = ["Meta-analysis\nlearning", "Leaderboard\ninteractions"]
    values = [0.49, 29.61]
    colors = [GREEN, YELLOW]
    fig, axes = plt.subplots(1, 2, figsize=(8.6, 4.8), facecolor=BG)
    for ax in axes:
        style_ax(ax)
    axes[0].bar([labels[0]], [values[0]], color=colors[0], width=0.45)
    axes[0].set_ylim(0, 0.7)
    axes[0].set_ylabel("Hedges g", color=MUTED)
    axes[0].set_title("Gamificarea ajuta invatarea", color=TEXT, fontsize=13, weight="bold")
    axes[0].text(0, values[0] + 0.04, "g = 0.49", color=TEXT, ha="center", weight="bold")

    axes[1].bar([labels[1]], [values[1]], color=colors[1], width=0.45)
    axes[1].set_ylim(0, 36)
    axes[1].set_ylabel("interactiuni medii in plus", color=MUTED)
    axes[1].set_title("Leaderboard = mai mult timp pe task", color=TEXT, fontsize=13, weight="bold")
    axes[1].text(0, values[1] + 1.4, "+29.61", color=TEXT, ha="center", weight="bold")

    fig.suptitle("De ce folosim competitii si leaderboard", color=TEXT, fontsize=18, weight="bold")
    fig.text(
        0.02,
        0.02,
        "Surse: Sailer & Homner (2020); Landers & Landers (2014)",
        color=MUTED,
        fontsize=8,
    )
    save(fig, "gamification-impact.png")


def monthly_costs() -> None:
    labels = ["Hosting/API", "DB", "Tool-uri AI", "Marketing", "Premii", "Profesori"]
    values = [500, 220, 650, 1100, 550, 2400]
    fig, ax = plt.subplots(figsize=(8.6, 4.8), facecolor=BG)
    style_ax(ax)
    ax.bar(labels, values, color=[BLUE, TEAL, VIOLET, ORANGE, YELLOW, GREEN])
    ax.set_title("Costuri lunare estimate pentru MVP", color=TEXT, fontsize=18, weight="bold", pad=14)
    ax.set_ylabel("lei / luna", color=MUTED)
    ax.tick_params(axis="x", rotation=16)
    for i, value in enumerate(values):
        ax.text(i, value + 70, f"{value} lei", color=TEXT, ha="center", fontsize=9, weight="bold")
    ax.text(2.5, 3600, "Total estimat: ~5.420 lei/luna", color=TEXT, ha="center", fontsize=12, weight="bold")
    fig.text(0.02, 0.02, "Sursa: estimare interna ReformOne pentru scenariul MVP.", color=MUTED, fontsize=8)
    save(fig, "monthly-costs.png")


def monthly_revenue() -> None:
    labels = ["Plus", "Pro", "Elite", "Friends", "Sponsori", "Workshopuri"]
    values = [1470, 1980, 1990, 3180, 2000, 1200]
    fig, ax = plt.subplots(figsize=(8.6, 4.8), facecolor=BG)
    style_ax(ax)
    ax.bar(labels, values, color=[BLUE, GREEN, VIOLET, ORANGE, YELLOW, TEAL])
    ax.set_title("Venituri lunare posibile dupa lansare", color=TEXT, fontsize=18, weight="bold", pad=14)
    ax.set_ylabel("lei / luna", color=MUTED)
    ax.tick_params(axis="x", rotation=16)
    for i, value in enumerate(values):
        ax.text(i, value + 90, f"{value} lei", color=TEXT, ha="center", fontsize=9, weight="bold")
    ax.text(2.5, 4700, "Scenariu: 30 Plus, 20 Pro, 10 Elite, 20 Friends", color=TEXT, ha="center", fontsize=11, weight="bold")
    fig.text(0.02, 0.02, "Sursa: estimare interna ReformOne, abonamente + sponsori + workshopuri.", color=MUTED, fontsize=8)
    save(fig, "monthly-revenue.png")


if __name__ == "__main__":
    edtech_market()
    gamification()
    monthly_costs()
    monthly_revenue()
