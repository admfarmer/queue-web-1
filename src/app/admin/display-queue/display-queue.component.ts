import { Component, OnInit, ViewChild, NgZone, Inject, OnDestroy, Directive, HostListener } from '@angular/core';
import { ModalSelectServicepointsComponent } from 'src/app/shared/modal-select-servicepoints/modal-select-servicepoints.component';
import { QueueService } from 'src/app/shared/queue.service';
import { AlertService } from 'src/app/shared/alert.service';
import * as mqttClient from '../../../vendor/mqtt';
import { MqttClient } from 'mqtt';
import * as _ from 'lodash';
import * as Random from 'random-js';

import { Howl, Howler } from 'howler';

import { CountdownComponent } from 'ngx-countdown';
import { Router, ActivatedRoute } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

@Component({
  selector: 'app-display-queue',
  templateUrl: './display-queue.component.html',
  styles: [
    `
    .main-panel {
        transition: width 0.25s ease, margin 0.25s ease;
        width: 100%;
        min-height: calc(100vh - 70px);
        display: flex;
        flex-direction: column;
    }

    .bg-primary, .settings-panel .color-tiles .tiles.primary {
        background-color: #01579b !important;
    }

    .bg-blue, .settings-panel .color-tiles .tiles.danger {
        background-color: #1a237e !important;
    }

    `

  ]
})
export class DisplayQueueComponent implements OnInit, OnDestroy {

  @ViewChild('mdlServicePoint') private mdlServicePoint: ModalSelectServicepointsComponent;
  @ViewChild(CountdownComponent) counter: CountdownComponent;

  jwtHelper = new JwtHelperService();
  servicePointTopic = null;

  servicePointId: any;
  servicePointName: any;
  workingItems: any = [];
  workingItemsHistory: any = [];
  currentQueueNumber: any;
  currentRoomNumber: any;
  currentHn: any;
  currentRoomName: any;

  isOffline = false;

  client: MqttClient;
  notifyUser = null;
  notifyPassword = null;

  isSound = true;
  isPlayingSound = false;

  playlists: any = [];
  notifyUrl: string;
  token: string;

  soundFile: any;
  soundSpeed: any;
  speakSingle = true;
  constructor(
    private queueService: QueueService,
    private alertService: AlertService,
    private zone: NgZone,
    private router: Router,
    private route: ActivatedRoute
  ) {

    this.route.queryParams
      .subscribe(params => {
        this.token = params.token || null;
        this.servicePointId = +params.servicePointId || null;
        this.servicePointName = params.servicePointName || null;
      });

  }

  async ngOnInit() {
    try {
      const token = this.token || sessionStorage.getItem('token');
      if (token) {
        const decodedToken = this.jwtHelper.decodeToken(token);
        this.servicePointTopic = decodedToken.SERVICE_POINT_TOPIC;
        this.notifyUrl = `ws://${decodedToken.NOTIFY_SERVER}:${+decodedToken.NOTIFY_PORT}`;
        this.notifyUser = decodedToken.NOTIFY_USER;
        this.notifyPassword = decodedToken.NOTIFY_PASSWORD;
        const spk: any = await this.queueService.getSettingSpeak(token);
        if (spk.statusCode === 200) {
          this.speakSingle = spk.results === 'N' ? false : true;
        }
        if (sessionStorage.getItem('servicePoints')) {
          const _servicePoints = sessionStorage.getItem('servicePoints');
          const jsonDecodedServicePoint = JSON.parse(_servicePoints);
          if (jsonDecodedServicePoint.length === 1) {
            this.onSelectedPoint(jsonDecodedServicePoint[0]);
          } else if (this.servicePointId && this.servicePointName) {
            this.initialSocket();
          }
        } else {
          if (this.servicePointId) {
            this.onSelectedPoint({ 'service_point_id': this.servicePointId, 'service_point_name': this.servicePointName });
          } else {
            this.initialSocket();
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  }


  public unsafePublish(topic: string, message: string): void {
    try {
      this.client.end(true);
    } catch (error) {
      console.log(error);
    }
  }

  public ngOnDestroy() {
    try {
      this.client.end(true);
    } catch (error) {
      console.log(error);
    }
  }

  toggleSound() {
    this.isSound = !this.isSound;
  }

  prepareSound() {
    if (!this.isPlayingSound) {
      if (this.playlists.length) {
        const queueNumber = this.playlists[0].queueNumber;
        const roomNumber = this.playlists[0].roomNumber;
        this.playSound(queueNumber, roomNumber);
      }
    }
  }

  playSound(strQueue: string, strRoomNumber: string) {

    this.isPlayingSound = true;

    let _queue = strQueue.toString().replace(' ', '');
    _queue = _queue.toString().replace('-', '');

    const _strQueue: any = _queue.split('');
    const _strRoom = strRoomNumber.split('');

    const audioFiles = [];

    audioFiles.push('./assets/audio/please.mp3');
    audioFiles.push('./assets/audio/silent.mp3');

    if (this.speakSingle) {
      _strQueue.forEach(v => {
        audioFiles.push(`./assets/audio/${v}.mp3`);
      });
    } else {
      const arrQueue = (_strQueue.join('')).match(/[a-z]+|[^a-z]+/gi);
      arrQueue.forEach(v => {
        if (!isNaN(v)) {
          let no = +v;
          if (no >= 10000) {
            audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
            audioFiles.push(`./assets/audio/10000.mp3`);
            no -= +no.toString().substr(0, 1) * 10000;
          }

          if (no >= 1000) {
            audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
            audioFiles.push(`./assets/audio/1000.mp3`);
            no -= +no.toString().substr(0, 1) * 1000;
          }
          if (no >= 100) {
            audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
            audioFiles.push(`./assets/audio/100.mp3`);
            no -= +no.toString().substr(0, 1) * 100;
          }
          if (no >= 10) {
            if (no >= 30) {
              audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
              audioFiles.push(`./assets/audio/10.mp3`);
            } else if (no >= 20) {
              audioFiles.push(`./assets/audio/20.mp3`);
            }
            no -= +no.toString().substr(0, 1) * 10;
            if (no === 1) {
              audioFiles.push(`./assets/audio/11.mp3`);
              no -= 1;
            }
          }
          if (no >= 1) {
            audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
            // audioFiles.push(`./assets/audio/10.mp3`);
            no -= +no.toString().substr(0, 1);
          }
        } else {
          audioFiles.push(`./assets/audio/${v}.mp3`);
        }
      });
    }

    if (this.soundFile) {
      audioFiles.push(`./assets/audio/${this.soundFile}`);
    } else {
      audioFiles.push('./assets/audio/channel.mp3');
    }

    if (this.speakSingle) {
      _strRoom.forEach(v => {
        audioFiles.push(`./assets/audio/${v}.mp3`);
      });
    } else {
      const arrRoom: any = (_strRoom.join('')).match(/[a-z]+|[^a-z]+/gi);
      if (!isNaN(arrRoom)) {
        let no = +arrRoom;
        if (no >= 10000) {
          audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
          audioFiles.push(`./assets/audio/10000.mp3`);
          no -= +no.toString().substr(0, 1) * 10000;
        }

        if (no >= 1000) {
          audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
          audioFiles.push(`./assets/audio/1000.mp3`);
          no -= +no.toString().substr(0, 1) * 1000;
        }
        if (no >= 100) {
          audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
          audioFiles.push(`./assets/audio/100.mp3`);
          no -= +no.toString().substr(0, 1) * 100;
        }
        if (no >= 10) {
          if (no >= 30) {
            audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
            audioFiles.push(`./assets/audio/10.mp3`);
          } else if (no >= 20) {
            audioFiles.push(`./assets/audio/20.mp3`);
          }
          no -= +no.toString().substr(0, 1) * 10;
          if (no === 1) {
            audioFiles.push(`./assets/audio/11.mp3`);
            no -= 1;
          }
        }
        if (no >= 1) {
          audioFiles.push(`./assets/audio/${no.toString().substr(0, 1)}.mp3`);
          no -= +no.toString().substr(0, 1);
        }
      }
    }

    audioFiles.push('./assets/audio/ka.mp3');

    const howlerBank = [];

    const loop = false;

    const onPlay = [false];
    let pCount = 0;
    const that = this;

    const onEnd = function (e) {

      if (loop) {
        pCount = (pCount + 1 !== howlerBank.length) ? pCount + 1 : 0;
      } else {
        pCount = pCount + 1;
      }

      if (pCount <= audioFiles.length - 1) {

        if (!howlerBank[pCount].playing()) {
          howlerBank[pCount].play();
        } else {
          howlerBank[pCount].stop();
          howlerBank[pCount].unload();
          howlerBank[pCount].play();
        }

      } else {
        this.isPlayingSound = false;
        // remove queue in playlist
        const idx = _.findIndex(that.playlists, { queueNumber: strQueue, roomNumber: strRoomNumber });
        if (idx > -1) {
          that.playlists.splice(idx, 1);
        }
        // call sound again
        setTimeout(() => {
          that.isPlayingSound = false;
          that.prepareSound();
        }, 1000);
      }
    };

    for (let i = 0; i < audioFiles.length; i++) {
      howlerBank.push(new Howl({
        src: [audioFiles[i]],
        onend: onEnd,
        preload: true,
        html5: true,
      }));
      if (this.soundSpeed) {
        howlerBank[i].rate(this.soundSpeed);
      }
    }

    try {
      howlerBank[0].play();
    } catch (error) {
      console.log(error);
    }
  }

  logout() {
    sessionStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  connectWebSocket() {
    const rnd = new Random();
    const username = sessionStorage.getItem('username');
    const strRnd = rnd.integer(1111111111, 9999999999);
    const clientId = `${username}-${strRnd}`;

    try {
      this.client = mqttClient.connect(this.notifyUrl, {
        clientId: clientId,
        username: this.notifyUser,
        password: this.notifyPassword
      });
    } catch (error) {
      console.log(error);
    }

    const topic = `${this.servicePointTopic}/${this.servicePointId}`;

    const that = this;

    this.client.on('message', (topic, payload) => {
      that.getCurrentQueue();
      that.getWorkingHistory();

      try {
        const _payload = JSON.parse(payload.toString());

        if (that.isSound) {
          if (+that.servicePointId === +_payload.servicePointId) {
            // play sound
            const sound = { queueNumber: _payload.queueNumber, roomNumber: _payload.roomNumber.toString() };
            that.playlists.push(sound);
            that.prepareSound();
          }
        }
      } catch (error) {
        console.log(error);
      }

    });

    this.client.on('connect', () => {
      console.log('Connected!');
      that.zone.run(() => {
        that.isOffline = false;
      });

      that.client.subscribe(topic, (error) => {
        if (error) {
          that.zone.run(() => {
            that.isOffline = true;
            try {
              that.counter.restart();
            } catch (error) {
              console.log(error);
            }
          });
        }
      });
    });

    this.client.on('close', () => {
      console.log('MQTT Conection Close');
    });

    this.client.on('error', (error) => {
      console.log('MQTT Error');
      that.zone.run(() => {
        that.isOffline = true;
        that.counter.restart();
      });
    });

    this.client.on('offline', () => {
      console.log('MQTT Offline');
      that.zone.run(() => {
        that.isOffline = true;
        try {
          that.counter.restart();
        } catch (error) {
          console.log(error);
        }
      });
    });
  }

  selectServicePoint() {
    this.mdlServicePoint.open();
  }

  async onSelectedPoint(event: any) {
    this.servicePointName = event.service_point_name;
    this.servicePointId = event.service_point_id;
    if (event.sound_file) {
      this.soundFile = event.sound_file;
      this.soundSpeed = event.sound_speed;
    } else {
      await this.getSound(this.servicePointId);
    }
    this.initialSocket();
  }

  async getSound(servicePointId) {
    try {
      const rs: any = await this.queueService.getSound(servicePointId, this.token);
      if (rs.statusCode === 200) {
        this.soundFile = rs.results.length ? rs.results[0].sound_file : null;
        this.soundSpeed = rs.results.length ? rs.results[0].sound_speed : null;
      }
    } catch (error) {
      console.log(error);
      this.alertService.error(error);
    }
  }

  initialSocket() {
    // connect mqtt
    this.connectWebSocket();
    this.getCurrentQueue();
    this.getWorkingHistory();
  }

  async getCurrentQueue() {
    try {
      const rs: any = await this.queueService.getWorking(this.servicePointId, this.token);
      if (rs.statusCode === 200) {
        this.workingItems = rs.results;
        const arr = _.sortBy(rs.results, ['update_date']).reverse();

        if (arr.length > 0) {
          this.currentHn = arr[0].hn;
          this.currentQueueNumber = arr[0].queue_number;
          this.currentRoomName = arr[0].room_name;
          this.currentRoomNumber = arr[0].room_number;
        } else {
          this.currentHn = null;
          this.currentQueueNumber = null;
          this.currentRoomName = null;
          this.currentRoomNumber = null;
        }
      } else {
        console.log(rs.message);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.log(error);
      this.alertService.error();
    }
  }

  async getWorkingHistory() {
    try {
      const rs: any = await this.queueService.getWorkingHistory(this.servicePointId, this.token);
      if (rs.statusCode === 200) {
        this.workingItemsHistory = rs.results;
      } else {
        console.log(rs.message);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.log(error);
      this.alertService.error();
    }
  }

}
