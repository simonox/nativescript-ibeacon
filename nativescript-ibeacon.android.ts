import {
    Beacon, BeaconCallback, BeaconLocationOptionsAndroidAuthType, BeaconRegion,
    Common
} from './nativescript-ibeacon.common';
import * as utils from "utils/utils";
import {setActivityCallbacks, AndroidActivityCallbacks} from "ui/frame";

var permissions = require( "nativescript-permissions" );

declare let org: any;
declare let android:any;

@Interfaces([org.altbeacon.beacon.BeaconConsumer])
export class LocationService extends java.lang.Object {
    private beaconManager: any = null;
    public delegate: BeaconCallback = null;

    private context: android.content.Context;

    private beaconManagerReady: boolean = false;
    private rangeNotifierAdded: boolean = false;

    private pendingBeaconRegion: BeaconRegion = null;

    constructor(context: android.content.Context) {
        super();
        console.log("constructor");
        this.context = context;

        return global.__native(this);
    }

    public bind() {
        this.getBeaconManager().bind(this);
    }

    public unbind() {
        this.beaconManagerReady = false;
        this.getBeaconManager().unbind(this);
    }

    private getBeaconManager() {
        if (this.beaconManager == null) {
            this.beaconManager = org.altbeacon.beacon.BeaconManager.getInstanceForApplication(this.context/*utils.ad.getApplicationContext()*/);
            this.beaconManager.getBeaconParsers().add(new org.altbeacon.beacon.BeaconParser().setBeaconLayout("m:2-3=0215,i:4-19,i:20-21,i:22-23,p:24-24"));  //iBeacon Layout
            console.log("beaconManager created");
        }
        return this.beaconManager;
    }

    public startRanging(beaconRegion: BeaconRegion) {
        if (this.beaconManagerReady) {
            console.log("startRanging");
            try {
                console.log("startRangingBeaconsInRegion");
                this.getBeaconManager().startRangingBeaconsInRegion(this.getRegionFromBeaconRegion(beaconRegion)); //
                console.log("startRangingBeaconsInRegion2");
            } catch (e) {
                //e.printStackTrace();
            }
        } else {
            console.log("startRanging stopped: beacon manager not ready");
            this.pendingBeaconRegion = beaconRegion;
            this.bind(); // init the beacon manager
        }
    }

    public stopRanging(beaconRegion: BeaconRegion) {
        if (this.beaconManagerReady) {
            console.log("stopRanging");
            this.getBeaconManager().stopRangingBeaconsInRegion(this.getRegionFromBeaconRegion(beaconRegion));
            this.unbind();
            //this.beaconManager = null;
            //this.myCallback = null;
        } else {
            console.log("startRanging stopped: beacon manager not ready");
        }
    }

    /*private getContext() {
     let context = application.android.context;
     return context
     }*/

    public onBeaconServiceConnect() {
        console.log("onBeaconServiceConnect");
        this.beaconManagerReady = true;
        let me = this;

        if (!this.rangeNotifierAdded) {
            this.rangeNotifierAdded = true;
            this.getBeaconManager().addRangeNotifier(new org.altbeacon.beacon.RangeNotifier({

                didRangeBeaconsInRegion: function (beacons: /*java.util.Collection<org.altbeacon.beacon.Beacon>*/any, region: /*org.altbeacon.beacon.Region*/any) {
                    console.log("didRangeBeaconsInRegion");
                    //if (beacons.size() > 0) {
                    if (me.delegate) {
                        let beaconsArray = beacons.toArray();
                        let beaconsList: Beacon[] = [];
                        for (let c = 0; c < beaconsArray.length; c++) {
                            let beacon = beaconsArray[c];
                            beaconsList.push(me.getBeaconFromNativeBeacon(beacon));
                        }
                        /*while (beacons.iterator().hasNext()) {
                         let beacon = beacons.iterator().next();
                         //console.log("TEST", "LS: The first beacon " + beacon.getId1().toUuid().toString() + " I see is about " + beacon.getDistance() + " meters away.");
                         beaconsList.push(me.getBeaconFromNativeBeacon(beacon));
                         }*/
                        me.delegate.didRangeBeaconsInRegion(me.getBeaconRegionFromRegion(region), beaconsList);
                    }
                    //}
                }
            }));
        }

        if (this.pendingBeaconRegion != null) {
            this.startRanging(this.pendingBeaconRegion);
            this.pendingBeaconRegion = null;
        }
    }

    getRegionFromBeaconRegion(beaconRegion: BeaconRegion): any {
        let minor = null;
        if (beaconRegion.minor) {
            minor = org.altbeacon.beacon.Identifier.fromInt(beaconRegion.minor);
        }

        let major = null;
        if (beaconRegion.major) {
            major = org.altbeacon.beacon.Identifier.fromInt(beaconRegion.major);
        }

        return new org.altbeacon.beacon.Region(beaconRegion.identifier, org.altbeacon.beacon.Identifier.fromUuid(java.util.UUID.fromString(beaconRegion.proximityUUID)), major, minor);
    }

    getBeaconRegionFromRegion(region: any /*org.altbeacon.beacon.Region*/): BeaconRegion {
        let major = null;
        if (region.getId2()) {
            major = Number(region.getId2().toString())
        }
        let minor = null;
        if (region.getId3()) {
            minor = Number(region.getId3().toString())
        }
        let breagion = new BeaconRegion(region.getUniqueId(), region.getId1().toString(), major, minor);
        return breagion;
    }

    getBeaconFromNativeBeacon(nativeBeacon: any): Beacon {
        let beacon = new Beacon(nativeBeacon.getId1().toString(), nativeBeacon.getId2().toInt(), nativeBeacon.getId3().toInt());
        beacon.distance_proximity = nativeBeacon.getDistance();
        beacon.rssi = nativeBeacon.getRssi();
        beacon.txPower_accuracy = nativeBeacon.getTxPower();
        return beacon;
    }

    public getApplicationContext() {
        return this.context;
    }


    public unbindService(serviceConnection: android.content.ServiceConnection) {
        this.context.unbindService(serviceConnection);
    }


    public bindService(intent: android.content.Intent, serviceConnection: android.content.ServiceConnection, i: number): boolean {
        return this.context.bindService(intent, serviceConnection, i);
    }
}

export class NativescriptIbeacon extends Common {
    private locationService: LocationService = null;

    constructor(beaconCallback: BeaconCallback) {
        super(beaconCallback);
        this.locationService = new LocationService(utils.ad.getApplicationContext());
        this.locationService.delegate = beaconCallback;
    }

    public requestAuthorization(): Promise<any> {
        return permissions.requestPermission(this.getPermission(), this.options.androidAuthorisationDescription);
    }

    public isAuthorised() : boolean {
        return permissions.hasPermission(this.getPermission());
    }

    private getPermission() {
        let permission = null;
        if (this.options.androidAuthorisationType==BeaconLocationOptionsAndroidAuthType.Coarse) {
            permission = android.Manifest.permission.ACCESS_COARSE_LOCATION;
        } else {
            permission = android.Manifest.permission.ACCESS_FINE_LOCATION;
        }
        return permission;
    }

    public startRanging(beaconRegion: BeaconRegion) {
        this.locationService.startRanging(beaconRegion);
    }

    public stopRanging(beaconRegion: BeaconRegion) {
        this.locationService.stopRanging(beaconRegion);
    }


}