import pandas as pd

# Load the Excel
df = pd.read_excel("AB Agri Gantt Creator.xlsx")

# Ensure Date From is datetime
df["Date From"] = pd.to_datetime(df["Date From"], errors="coerce")

# Sort by start date
sorted_df = df.sort_values(by="Date From")

# Show top 10 rows
print("=== Earliest tasks ===")
print(sorted_df.head(10).to_string(index=False))

# Save a sorted copy for inspection
sorted_df.to_excel("AB_Agri_Gantt_Sorted_preview.xlsx", index=False)
print("Saved sorted preview to AB_Agri_Gantt_Sorted_preview.xlsx")
