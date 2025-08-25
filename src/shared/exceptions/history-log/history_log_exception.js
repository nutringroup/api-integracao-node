class HistoryLogError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HistoryLogeValidation';
  }
}

module.exports = HistoryLogError;