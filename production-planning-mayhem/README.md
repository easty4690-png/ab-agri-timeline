# Production Planning Mayhem

A standalone, installable browser game that simulates a fictional potable-water supply system over 14 accelerated daily stages.

## Model scope

- 48 half-hour continuity steps per day
- Two treatment works and one emergency bulk import
- Four storage assets serving six towns
- Population-based domestic demand plus fictional non-household demand
- Morning/evening demand profiles and deterministic forecast error
- Pressure-dependent delivery using elevation head and flow-dependent loss
- Pressure-sensitive background leakage and discrete burst events
- Completely mixed storage water-age approximation
- Source, transfer, storage, service, quality and efficiency scoring

## Research basis

The model design follows public principles described by:

- US EPA EPANET and the EPANET 2.2 manual: extended-period simulation, tanks, pumps, patterns, controls and pressure-dependent demand
- Ofwat: customer pressure standards, leakage measurement and pressure management
- Drinking Water Inspectorate: drinking-water standards and service-reservoir quality controls

Public references:

- https://www.epa.gov/water-research/epanet
- https://usepa.github.io/EPANET2.2/
- https://www.ofwat.gov.uk/households/supply-and-standards/water-pressure/
- https://www.ofwat.gov.uk/households/supply-and-standards/leakage/
- https://www.dwi.gov.uk/drinking-water-standards-and-regulations/

This is an educational game, not a live engineering, regulatory or operational model. The network, assets, towns and events are entirely fictional.
