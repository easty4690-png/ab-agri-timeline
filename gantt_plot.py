import pandas as pd
import matplotlib.pyplot as plt

# Load the source Excel
df = pd.read_excel("AB Agri Gantt Creator.xlsx")

# Normalize / coerce date columns
df["Date From"] = pd.to_datetime(df["Date From"], errors="coerce")
df["Date To"] = pd.to_datetime(df["Date To"], errors="coerce")

# Drop rows without a valid start
df = df.dropna(subset=["Date From"])

# Compute duration in days; fallback to 1 if missing
df["Duration"] = (df["Date To"] - df["Date From"]).dt.days
df.loc[df["Duration"].isna(), "Duration"] = 1

# Sort by start date
df = df.sort_values(by="Date From")

# Determine lanes (use Line Ref if present)
if "Line Ref" in df.columns:
    lanes = df["Line Ref"].astype(str)
else:
    lanes = df.index.astype(str)

unique_lanes = sorted(lanes.unique())
lane_to_y = {lane: i for i, lane in enumerate(unique_lanes)}

fig, ax = plt.subplots(figsize=(10, max(4, len(unique_lanes) * 0.5)))

for _, row in df.iterrows():
    lane = str(row["Line Ref"]) if "Line Ref" in row else str(row.name)
    y = lane_to_y.get(lane, 0)
    start = row["Date From"]
    duration = row["Duration"]
    ax.barh(y, duration, left=start, height=0.4, align="center")
    # mark zero-length/milestone
    if duration == 0 or pd.isna(row["Date To"]) or start == row["Date To"]:
        ax.plot(start, y, marker="o", markersize=6, color="black")

ax.set_yticks(list(lane_to_y.values()))
ax.set_yticklabels(unique_lanes)
ax.invert_yaxis()
ax.set_xlabel("Date")
ax.set_title("AB Agri Timeline Gantt Preview")
plt.tight_layout()
plt.xticks(rotation=30)

plt.savefig("gantt_preview.png", dpi=150)
print("Saved gantt_preview.png")
