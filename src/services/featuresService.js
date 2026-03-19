/**
 * Features Service
 * Manages enabling/disabling of optional bot features
 */

class FeaturesService {
  constructor ( dataService ) {
    this.dataService = dataService;
  }

  /**
   * Check if a feature is enabled
   * @param {string} featureName - Name of the feature to check
   * @returns {boolean} True if feature is enabled (not in disabled list)
   */
  isFeatureEnabled ( featureName ) {
    const disabledFeatures = this.dataService.getValue( 'disabledFeatures' ) || [];
    return !disabledFeatures.includes( featureName );
  }

  /**
   * Enable a feature by removing it from the disabled list
   * @param {string} featureName - Name of the feature to enable
   * @returns {boolean} True if feature was successfully enabled
   */
  enableFeature ( featureName ) {
    const disabledFeatures = this.dataService.getValue( 'disabledFeatures' ) || [];
    const index = disabledFeatures.indexOf( featureName );

    if ( index > -1 ) {
      disabledFeatures.splice( index, 1 );
      this.dataService.setValue( 'disabledFeatures', disabledFeatures );
      return true;
    }

    return false; // Feature was already enabled
  }

  /**
   * Disable a feature by adding it to the disabled list
   * @param {string} featureName - Name of the feature to disable
   * @returns {boolean} True if feature was successfully disabled
   */
  disableFeature ( featureName ) {
    const disabledFeatures = this.dataService.getValue( 'disabledFeatures' ) || [];

    if ( !disabledFeatures.includes( featureName ) ) {
      disabledFeatures.push( featureName );
      this.dataService.setValue( 'disabledFeatures', disabledFeatures );
      return true;
    }

    return false; // Feature was already disabled
  }

  /**
   * Get all available features (both enabled and disabled)
   * @returns {Object} Object with enabled and disabled feature arrays
   */
  getAllFeatures () {
    // Define all available features
    const allFeatures = [
      'welcomeMessage',
      'nowPlayingMessage',
      'justPlayed',
      'afkMonitor'
    ];

    const disabledFeatures = this.dataService.getValue( 'disabledFeatures' ) || [];
    const enabledFeatures = allFeatures.filter( feature => !disabledFeatures.includes( feature ) );

    return {
      enabled: enabledFeatures,
      disabled: disabledFeatures.filter( feature => allFeatures.includes( feature ) )
    };
  }
}

module.exports = FeaturesService;