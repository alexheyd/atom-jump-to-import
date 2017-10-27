'use babel';

module.exports = {
  /**
   * If logging is enabled or not
   * @type {Boolean}
   */
  enabled: false,

  /**
   * Data to report
   * @type {Object}
   */
  toReport: {
    notFound: []
  },

  /**
   * Enable logging
   * @method enable
   */
  enable() {
    this.enabled = true;
  },

  /**
   * Disable logging
   * @method disable
   */
  disable() {
    this.enabled = false;
  },

  /**
   * Log debug data to console
   * @method debugLog
   */
  debugLog() {
    if (this.enabled) {
      console.info('[jump-to-import] Debug Report: ', this.toReport);
    }
  },

  /**
   * Save data points to report
   * @method   report
   * @param    {Object} obj Hash of properties to save
   */
  report(obj) {
    const { toReport } = this;

    if (obj.notFound) {
      if (!toReport.notFound.includes(obj.notFound)) {
        toReport.notFound.push(obj.notFound);
      }

      delete obj.notFound;
    }

    const report = {
      ...toReport,
      ...obj
    };

    this.toReport = report;
  }
};
