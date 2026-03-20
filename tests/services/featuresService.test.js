const FeaturesService = require( '../../src/services/featuresService' );

describe( 'FeaturesService', () => {
  let featuresService;
  let mockDataService;

  beforeEach( () => {
    mockDataService = {
      getValue: jest.fn(),
      setValue: jest.fn()
    };
    featuresService = new FeaturesService( mockDataService );
  } );

  describe( 'isFeatureEnabled', () => {
    it( 'should return true when feature is not in disabled list', () => {
      mockDataService.getValue.mockReturnValue( [ 'otherFeature' ] );

      const result = featuresService.isFeatureEnabled( 'welcomeMessage' );

      expect( result ).toBe( true );
      expect( mockDataService.getValue ).toHaveBeenCalledWith( 'disabledFeatures' );
    } );

    it( 'should return false when feature is in disabled list', () => {
      mockDataService.getValue.mockReturnValue( [ 'welcomeMessage', 'otherFeature' ] );

      const result = featuresService.isFeatureEnabled( 'welcomeMessage' );

      expect( result ).toBe( false );
    } );

    it( 'should return true when disabled features list is null/undefined', () => {
      mockDataService.getValue.mockReturnValue( null );

      const result = featuresService.isFeatureEnabled( 'welcomeMessage' );

      expect( result ).toBe( true );
    } );
  } );

  describe( 'enableFeature', () => {
    it( 'should remove feature from disabled list and return true', () => {
      mockDataService.getValue.mockReturnValue( [ 'welcomeMessage', 'otherFeature' ] );

      const result = featuresService.enableFeature( 'welcomeMessage' );

      expect( result ).toBe( true );
      expect( mockDataService.setValue ).toHaveBeenCalledWith( 'disabledFeatures', [ 'otherFeature' ] );
    } );

    it( 'should return false when feature is already enabled', () => {
      mockDataService.getValue.mockReturnValue( [ 'otherFeature' ] );

      const result = featuresService.enableFeature( 'welcomeMessage' );

      expect( result ).toBe( false );
      expect( mockDataService.setValue ).not.toHaveBeenCalled();
    } );

    it( 'should handle empty disabled features list', () => {
      mockDataService.getValue.mockReturnValue( [] );

      const result = featuresService.enableFeature( 'welcomeMessage' );

      expect( result ).toBe( false );
      expect( mockDataService.setValue ).not.toHaveBeenCalled();
    } );
  } );

  describe( 'disableFeature', () => {
    it( 'should add feature to disabled list and return true', () => {
      mockDataService.getValue.mockReturnValue( [ 'otherFeature' ] );

      const result = featuresService.disableFeature( 'welcomeMessage' );

      expect( result ).toBe( true );
      expect( mockDataService.setValue ).toHaveBeenCalledWith( 'disabledFeatures', [ 'otherFeature', 'welcomeMessage' ] );
    } );

    it( 'should return false when feature is already disabled', () => {
      mockDataService.getValue.mockReturnValue( [ 'welcomeMessage', 'otherFeature' ] );

      const result = featuresService.disableFeature( 'welcomeMessage' );

      expect( result ).toBe( false );
      expect( mockDataService.setValue ).not.toHaveBeenCalled();
    } );

    it( 'should handle null disabled features list', () => {
      mockDataService.getValue.mockReturnValue( null );

      const result = featuresService.disableFeature( 'welcomeMessage' );

      expect( result ).toBe( true );
      expect( mockDataService.setValue ).toHaveBeenCalledWith( 'disabledFeatures', [ 'welcomeMessage' ] );
    } );
  } );

  describe( 'getAllFeatures', () => {
    it( 'should return enabled and disabled features correctly', () => {
      mockDataService.getValue.mockReturnValue( [ 'nowPlayingMessage' ] );

      const result = featuresService.getAllFeatures();

      expect( result ).toEqual( {
        enabled: [ 'welcomeMessage', 'justPlayed', 'afkMonitor' ],
        disabled: [ 'nowPlayingMessage' ]
      } );
    } );

    it( 'should handle empty disabled features list', () => {
      mockDataService.getValue.mockReturnValue( [] );

      const result = featuresService.getAllFeatures();

      expect( result ).toEqual( {
        enabled: [ 'welcomeMessage', 'nowPlayingMessage', 'justPlayed', 'afkMonitor' ],
        disabled: []
      } );
    } );

    it( 'should filter out unknown features from disabled list', () => {
      mockDataService.getValue.mockReturnValue( [ 'nowPlayingMessage', 'unknownFeature', 'anotherUnknown' ] );

      const result = featuresService.getAllFeatures();

      expect( result ).toEqual( {
        enabled: [ 'welcomeMessage', 'justPlayed', 'afkMonitor' ],
        disabled: [ 'nowPlayingMessage' ]
      } );
    } );
  } );
} );