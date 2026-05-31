module {
  // Director record for LLC-type businesses
  public type DirectorRecord = {
    directorName : Text;
    bvn : Text;
    nin : Text;
    nationality : Text;
    ownershipPercentage : Float;
  };

  // Proprietor record for Business Name registrations
  public type ProprietorRecord = {
    proprietorName : Text;
    bvn : Text;
    nin : Text;
  };

  // Legal entity type for a registered business
  public type BusinessTypeEnum = {
    #llc;
    #businessName;
  };

  // Preferred Islamic financing instrument (Qard al-Hasan excluded — not a commercial instrument)
  public type PreferredInstrument = {
    #murabaha;      // cost-plus sale: financier buys asset, sells to borrower at marked-up price
    #musharakah;    // partnership: both parties contribute capital and share profit/loss
    #mudarabah;     // profit-sharing: financier provides capital, borrower provides expertise
    #ijarah;        // lease: financier buys and leases asset to borrower
    #istisna;       // manufacturing/construction finance: advance payment for future delivery
    #salam;         // agricultural advance: full payment now for deferred goods delivery
    #other;
  };
};
