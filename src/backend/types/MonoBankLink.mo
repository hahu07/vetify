import Common "common";

module {
  public type BankLinkStatus = {
    #NotLinked;
    #Linked;
    #LinkFailed : Text;  // contains the specific failing call name
  };

  public type TransactionSummary = {
    income : Nat;
    totalCredits : Nat;
    totalDebits : Nat;
    months : Nat;
  };

  public type BankLinkRecord = {
    status : BankLinkStatus;
    accountId : ?Text;
    institutionName : ?Text;
    balance : ?Nat;
    currency : ?Text;
    linkedAt : ?Common.Timestamp;
    transactionSummary : ?TransactionSummary;
  };

  public func defaultBankLinkRecord() : BankLinkRecord = {
    status = #NotLinked;
    accountId = null;
    institutionName = null;
    balance = null;
    currency = null;
    linkedAt = null;
    transactionSummary = null;
  };
};
