import BizExt "BusinessExtended";

module {
  // Financier entity type
  public type FinancierType = {
    #institution;
    #individual;
    #group;
  };

  // Details for institutional financiers (Islamic banks, MFIs, DFIs).
  // preferredInstruments uses the same typed variant as BusinessExtended
  // so Kashif can match instruments directly without text heuristics.
  public type InstitutionDetails = {
    licenseNumber : Text;
    riskAppetite : Text;
    ticketSizeMin : Nat;
    ticketSizeMax : Nat;
    preferredInstruments : [BizExt.PreferredInstrument];
  };

  // Details for individual (angel / HNW) financiers.
  // preferredInstruments replaces the old [Text] field.
  public type IndividualDetails = {
    fullName : Text;
    bvn : Text;
    nin : Text;
    occupation : Text;
    investmentCapacity : Nat;
    preferredInstruments : [BizExt.PreferredInstrument];
    riskAppetite : Text;
  };

  // Details for group financiers (co-operatives, investment clubs, family offices).
  // preferredInstruments replaces the old [Text] field.
  public type GroupDetails = {
    groupName : Text;
    numberOfMembers : Nat;
    leadContactName : Text;
    leadContactBvn : Text;
    leadContactNin : Text;
    combinedInvestmentCapacity : Nat;
    legalBasis : Text;
    preferredInstruments : [BizExt.PreferredInstrument];
    riskAppetite : Text;
  };
};
