def generate_explanation(features: list[float], risk_score: float) -> str:
    """
    Builds a rule-based explanation string prioritising the top 2 risk components.
    Features array mapping:
      0: amount_log
      1: is_round_amount
      2: hour_of_day
      3: is_night_transaction
      4: vpa_domain_match 
      5: amount_zscore
      6: velocity_score
      7: location_risk_score
    """
    is_round_amount = features[1] == 1.0
    is_night_transaction = features[3] == 1.0
    vpa_domain_match = features[4] == 1.0
    amount_zscore = features[5]
    velocity_score = features[6]
    location_risk_score = features[7]

    risk_factors = []

    if velocity_score >= 5:
        risk_factors.append((velocity_score * 0.1, f"unusually high velocity ({int(velocity_score)} transactions in 60s)"))
    
    if location_risk_score >= 0.8:
        risk_factors.append((location_risk_score, "an unknown or suspicious sender location"))
        
    if amount_zscore >= 2.0:
        risk_factors.append((min(1.0, amount_zscore * 0.2), "a large amount anomaly compared to recent transactions"))
        
    if is_night_transaction:
        risk_factors.append((0.3, "a night-time transaction pattern"))
        
    if is_round_amount:
        risk_factors.append((0.2, "a perfectly round anomalous amount"))
        
    if not vpa_domain_match and amount_zscore >= 1.0:
        risk_factors.append((0.25, "a VPA domain mismatch combined with elevated transfer volume"))

    # Sort based on the heuristic scores we attached (highest first)
    risk_factors.sort(key=lambda x: x[0], reverse=True)

    if risk_score >= 0.65:
        base_str = "Transaction frozen:"
        
        # Take the top 2 risk factors
        top_factors = [factor[1] for factor in risk_factors[:2]]
        
        if len(top_factors) == 0:
            return f"{base_str} High predictive model risk score."
        elif len(top_factors) == 1:
            return f"{base_str} {top_factors[0].capitalize()} indicates potential fraud."
        else:
            return f"{base_str} {top_factors[0].capitalize()} combined with {top_factors[1]} indicates coordinated fraud ring activity."
            
    else:
        return "Transaction cleared: No significant anomaly detected in velocity, location, or amount patterns."
