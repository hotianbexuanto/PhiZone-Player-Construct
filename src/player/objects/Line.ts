import { GameObjects } from 'phaser';
import {
  type ColorEvent,
  type Event,
  type GifEvent,
  type JudgeLine,
  type SpeedEvent,
  type TextEvent,
} from '../types';
import { LongNote } from './LongNote';
import { PlainNote } from './PlainNote';
import {
  getIntegral,
  getLineColor,
  getTimeSec,
  getValue,
  processEvents,
  rgbToHex,
  toBeats,
} from '../utils';
import type { Game } from '../scenes/Game';
import { FONT_FAMILY } from '../constants';
import { dot } from 'mathjs';

export class Line {
  private _scene: Game;
  private _num: number;
  private _data: JudgeLine;
  private _line: GameObjects.Image | GameObjects.Sprite | GameObjects.Text;
  private _parent: Line | null = null;
  private _flickContainer: GameObjects.Container;
  private _tapContainer: GameObjects.Container;
  private _dragContainer: GameObjects.Container;
  private _holdContainer: GameObjects.Container;
  private _noteMask: GameObjects.Graphics | null = null;
  private _notes: (PlainNote | LongNote)[] = [];
  private _hasCustomTexture: boolean = false;
  private _hasAnimatedTexture: boolean = false;
  private _hasText: boolean = false;
  private _xModifier: 1 | -1 = 1;
  private _yModifier: 1 | -1 = 1;
  private _rotationModifier: 1 | -1 = 1;
  private _rotationOffset: 0 | 180 = 0;

  private _curX = [];
  private _curY = [];
  private _curRot = [];
  private _curAlpha = [];
  private _curSpeed = [];
  private _lastHeight = 0;

  private _curColor = [];
  private _curGif = [];
  private _curIncline = [];
  private _curScaleX = [];
  private _curScaleY = [];
  private _curText = [];

  private _opacity: number = 0;
  private _x: number = 0;
  private _y: number = 0;
  private _rotation: number = 0;
  private _color: number[] | undefined = undefined;
  private _gif: number | undefined = undefined;
  private _incline: number | undefined = undefined;
  private _scaleX: number | undefined = undefined;
  private _scaleY: number | undefined = undefined;
  private _text: string | undefined = undefined;
  private _height: number = 0;

  private _lastUpdate: number = -Infinity;

  constructor(scene: Game, lineData: JudgeLine, num: number, precedence: number) {
    this._scene = scene;
    this._num = num;
    this._data = lineData;
    this._hasText = (this._data.extended?.textEvents?.length ?? 0) > 0;
    this._hasCustomTexture = this._hasText || lineData.Texture !== 'line.png';
    this._hasAnimatedTexture = ['.gif', '.apng'].some((e) =>
      lineData.Texture.toLowerCase().endsWith(e),
    );
    this._line = this._hasText
      ? new GameObjects.Text(scene, 0, 0, this._text ?? '', {
          fontFamily: FONT_FAMILY,
          fontSize: 60,
          color: '#ffffff',
          align: 'left',
        }).setOrigin(0.5)
      : this._hasAnimatedTexture
        ? new GameObjects.Sprite(scene, 0, 0, `asset-${lineData.Texture}`).play(
            `asset-${lineData.Texture}`,
          )
        : new GameObjects.Image(scene, 0, 0, `asset-${lineData.Texture}`);
    this._line.setVisible(!this._data.attachUI || this._hasText);
    this._line.setScale(
      this._scene.p(1) * (this._scaleX ?? 1),
      this._scene.p(1) * (this._scaleY ?? 1),
    ); // previously 1.0125 (according to the official definition that a line is 3 times as wide as the screen)
    this._line.setDepth(2 + precedence);
    if (!this._hasCustomTexture) this._line.setTint(getLineColor(scene));
    if (this._data.anchor) this._line.setOrigin(this._data.anchor[0], 1 - this._data.anchor[1]);

    this._holdContainer = this.createContainer(3);
    this._dragContainer = this.createContainer(4);
    this._tapContainer = this.createContainer(5);
    this._flickContainer = this.createContainer(6);

    if (scene.preferences.chartFlipping & 1) {
      this._xModifier = -1;
      this._rotationModifier = -1;
    }
    if (scene.preferences.chartFlipping & 2) {
      this._yModifier = -1;
      this._rotationModifier = (-1 * this._xModifier) as 1 | -1;
      this._rotationOffset = 180;
    }

    if (lineData.scaleOnNotes === 2) {
      this._noteMask = new GameObjects.Graphics(scene);
      const mask = this._noteMask.createGeometryMask();
      this._holdContainer.setMask(mask);
      this._dragContainer.setMask(mask);
      this._tapContainer.setMask(mask);
      this._flickContainer.setMask(mask);
    }

    // this._flickContainer.add(scene.add.rectangle(0, 0, 10, 10, 0x00ff00).setOrigin(0.5));
    // this._flickContainer.add(
    //   scene.add
    //     .text(0, 20, num.toString(), {
    //       fontFamily: 'Outfit',
    //       fontSize: 25,
    //       color: '#ffffff',
    //       align: 'center',
    //     })
    //     .setOrigin(0.5),
    // );

    this.setVisible(false);
    scene.register(this._line);

    this._data.eventLayers.forEach((layer) => {
      processEvents(layer?.alphaEvents);
      processEvents(layer?.moveXEvents);
      processEvents(layer?.moveYEvents);
      processEvents(layer?.rotateEvents);
      processEvents(layer?.speedEvents);
    });

    if (this._data.extended) {
      processEvents(this._data.extended.colorEvents);
      processEvents(this._data.extended.gifEvents);
      processEvents(this._data.extended.inclineEvents);
      processEvents(this._data.extended.scaleXEvents);
      processEvents(this._data.extended.scaleYEvents);
      processEvents(this._data.extended.textEvents);
    }

    if (this._data.notes) {
      this._data.notes.forEach((note) => {
        note.startBeat = toBeats(note.startTime);
        note.endBeat = toBeats(note.endTime);
      });
      this._data.notes.sort((a, b) => a.startBeat - b.startBeat);
      this._data.notes.forEach((data) => {
        let note: PlainNote | LongNote;
        if (data.type === 2) {
          note = new LongNote(scene, data);
          note.setHeadHeight(this.calculateHeight(data.startBeat));
          note.setTailHeight(this.calculateHeight(data.endBeat));
        } else {
          note = new PlainNote(scene, data);
          note.setHeight(this.calculateHeight(data.startBeat));
        }
        this.addNote(note);
        note.setLine(this);
      });
    }
  }

  update(beat: number, songTime: number, gameTime: number) {
    if (gameTime == this._lastUpdate) return;
    this._lastUpdate = gameTime;
    this._parent?.update(beat, songTime, gameTime);
    this.handleEventLayers(beat);
    this.updateParams();
    this._notes.forEach((note) => {
      note.update(beat * this._data.bpmfactor, songTime, this._height, this._opacity >= 0);
    });
  }

  destroy() {
    this._line.destroy();
    this._flickContainer.destroy();
    this._tapContainer.destroy();
    this._dragContainer.destroy();
    this._holdContainer.destroy();
    this._notes.forEach((note) => {
      note.destroy();
    });
  }

  updateParams() {
    this._line.setScale(
      this._scene.p(1) * (this._scaleX ?? 1),
      this._scene.p(1) * (this._scaleY ?? 1),
    );
    if (this._hasText) (this._line as GameObjects.Text).setText(this._text ?? '');
    if (this._color) this._line.setTint(rgbToHex(this._color));
    else if (!this._hasCustomTexture) this._line.setTint(getLineColor(this._scene));
    const { x, y } = this.getPosition();
    const rotation =
      (this._rotationModifier * this._rotation + this._rotationOffset) * (Math.PI / 180);
    this._line.setPosition(x, y);
    this._line.setRotation(rotation);
    this._line.setAlpha(this._opacity / 255);
    [this._flickContainer, this._tapContainer, this._dragContainer, this._holdContainer].forEach(
      (obj) => {
        obj.setPosition(x, y);
        obj.setRotation(rotation);
        if (this._data.scaleOnNotes === 1) {
          obj.setScale(this._scaleX ?? 1, 1);
        }
      },
    );
    this.updateMask();
    if (this._data.attachUI) {
      const params = {
        x: this._line.x - this._scene.sys.canvas.width / 2,
        y: this._line.y - this._scene.sys.canvas.height / 2,
        rotation: this._line.rotation,
        alpha: this._line.alpha,
        scaleX: this._scaleX ?? 1,
        scaleY: this._scaleY ?? 1,
        tint: this._line.tint,
      };
      switch (this._data.attachUI) {
        case 'pause': {
          this._scene.gameUI.pause.setAttach(params);
          return;
        }
        case 'combonumber': {
          this._scene.gameUI.combo.setAttach(params, true);
          return;
        }
        case 'combo': {
          this._scene.gameUI.comboText.setAttach(params, true);
          return;
        }
        case 'score': {
          this._scene.gameUI.score.setAttach(params);
          this._scene.gameUI.accuracy.setAttach(params);
          return;
        }
        case 'bar': {
          this._scene.gameUI.progressBar.setAttach(params);
          return;
        }
        case 'name': {
          this._scene.gameUI.songTitle.setAttach(params);
          return;
        }
        case 'level': {
          this._scene.gameUI.level.setAttach(params);
          return;
        }
      }
    }
  }

  getPosition() {
    const halfScreenWidth = this._scene.sys.canvas.width / 2;
    const halfScreenHeight = this._scene.sys.canvas.height / 2;
    let x = this._scene.p(this._xModifier * this._x);
    let y = this._scene.o(this._yModifier * this._y);
    if (this._parent !== null) {
      const parentX = this._parent.x - halfScreenWidth;
      const parentY = this._parent.y - halfScreenHeight;
      const newX =
        parentX + x * Math.cos(this._parent.rotation) - y * Math.sin(this._parent.rotation);
      const newY =
        parentY + y * Math.cos(this._parent.rotation) + x * Math.sin(this._parent.rotation);
      x = newX;
      y = newY;
    }
    x += halfScreenWidth;
    y += halfScreenHeight;
    return { x, y };
  }

  createContainer(depth: number) {
    const container = new GameObjects.Container(this._scene);
    container.setDepth(depth);
    this._scene.register(container);
    return container;
  }

  handleEventLayers(beat: number) {
    ({
      alpha: this._opacity,
      x: this._x,
      y: this._y,
      rotation: this._rotation,
      height: this._height,
    } = this._data.eventLayers.reduce(
      (acc, _, i) => {
        const { alpha, x, y, rotation, height } = this.handleEventLayer(
          beat * this._data.bpmfactor,
          i,
        );
        return {
          alpha: acc.alpha + (alpha ?? 0),
          x: acc.x + (x ?? 0),
          y: acc.y + (y ?? 0),
          rotation: acc.rotation + (rotation ?? 0),
          height: acc.height + height,
        };
      },
      { alpha: 0, x: 0, y: 0, rotation: 0, height: 0 },
    ));
    ({
      color: this._color,
      gif: this._gif,
      incline: this._incline,
      scaleX: this._scaleX,
      scaleY: this._scaleY,
      text: this._text,
    } = this.handleExtendedEventLayer(beat * this._data.bpmfactor, 0));
  }

  handleSpeed(beat: number, layerIndex: number, events: SpeedEvent[] | undefined, cur: number[]) {
    while (cur.length < layerIndex + 1) {
      cur.push(0);
    }
    if (events && events.length > 0) {
      if (cur[layerIndex] > 0 && beat <= events[cur[layerIndex]].startBeat) {
        cur[layerIndex] = 0;
        this._lastHeight = 0;
      }
      while (cur[layerIndex] < events.length - 1 && beat > events[cur[layerIndex] + 1].startBeat) {
        this._lastHeight +=
          getIntegral(events[cur[layerIndex]], this._scene.bpmList) +
          events[cur[layerIndex]].end *
            (getTimeSec(this._scene.bpmList, events[cur[layerIndex] + 1].startBeat) -
              getTimeSec(this._scene.bpmList, events[cur[layerIndex]].endBeat));
        cur[layerIndex]++;
      }
      let height = this._lastHeight;
      if (beat <= events[cur[layerIndex]].endBeat) {
        height += getIntegral(events[cur[layerIndex]], this._scene.bpmList, beat);
      } else {
        height +=
          getIntegral(events[cur[layerIndex]], this._scene.bpmList) +
          events[cur[layerIndex]].end *
            (getTimeSec(this._scene.bpmList, beat) -
              getTimeSec(this._scene.bpmList, events[cur[layerIndex]].endBeat));
      }
      return height;
    } else {
      return 0;
    }
  }

  handleEvent(
    beat: number,
    layerIndex: number,
    events: (Event | ColorEvent | GifEvent | TextEvent)[] | undefined,
    cur: number[],
  ) {
    while (cur.length < layerIndex + 1) {
      cur.push(0);
    }
    if (events && events.length > 0) {
      if (cur[layerIndex] > 0 && beat <= events[cur[layerIndex]].startBeat) {
        cur[layerIndex] = 0;
      }
      while (cur[layerIndex] < events.length - 1 && beat > events[cur[layerIndex] + 1].startBeat) {
        cur[layerIndex]++;
      }
      if (
        typeof events[cur[layerIndex]].start === 'string' &&
        beat < events[cur[layerIndex]].startBeat
      ) {
        return undefined;
      } // shit code
      return getValue(beat, events[cur[layerIndex]]);
    } else {
      return undefined;
    }
  }

  handleEventLayer(
    beat: number,
    layerIndex: number,
  ): {
    alpha: number | undefined;
    x: number | undefined;
    y: number | undefined;
    rotation: number | undefined;
    height: number;
  } {
    const layer = this._data.eventLayers[layerIndex];
    if (!layer)
      return { alpha: undefined, x: undefined, y: undefined, rotation: undefined, height: 0 };

    return {
      alpha: this.handleEvent(beat, layerIndex, layer.alphaEvents, this._curAlpha) as
        | number
        | undefined,
      x: this.handleEvent(beat, layerIndex, layer.moveXEvents, this._curX) as number | undefined,
      y: this.handleEvent(beat, layerIndex, layer.moveYEvents, this._curY) as number | undefined,
      rotation: this.handleEvent(beat, layerIndex, layer.rotateEvents, this._curRot) as
        | number
        | undefined,
      height: this.handleSpeed(beat, layerIndex, layer.speedEvents, this._curSpeed),
    };
  }

  handleExtendedEventLayer(
    beat: number,
    layerIndex: number,
  ): {
    color: number[] | undefined;
    gif: number | undefined;
    incline: number | undefined;
    scaleX: number | undefined;
    scaleY: number | undefined;
    text: string | undefined;
  } {
    const extended = this._data.extended;
    if (!extended)
      return {
        color: undefined,
        gif: undefined,
        incline: undefined,
        scaleX: undefined,
        scaleY: undefined,
        text: undefined,
      };

    return {
      color: this.handleEvent(beat, layerIndex, extended.colorEvents, this._curColor) as
        | number[]
        | undefined,
      gif: this.handleEvent(beat, layerIndex, extended.gifEvents, this._curGif) as
        | number
        | undefined,
      incline: this.handleEvent(beat, layerIndex, extended.inclineEvents, this._curIncline) as
        | number
        | undefined,
      scaleX: this.handleEvent(beat, layerIndex, extended.scaleXEvents, this._curScaleX) as
        | number
        | undefined,
      scaleY: this.handleEvent(beat, layerIndex, extended.scaleYEvents, this._curScaleY) as
        | number
        | undefined,
      text: this.handleEvent(beat, layerIndex, extended.textEvents, this._curText) as
        | string
        | undefined,
    };
  }

  updateMask() {
    if (this._noteMask === null) return;
    const halfScreenWidth = this._scene.sys.canvas.width / 2;
    const halfScreenHeight = this._scene.sys.canvas.height / 2;
    const vector = this.vector;
    vector.scale(dot([this.x - halfScreenWidth, this.y - halfScreenHeight], [vector.x, vector.y]));
    vector.add(new Phaser.Math.Vector2(halfScreenWidth, halfScreenHeight));
    this._noteMask.setPosition(vector.x, vector.y);
    this._noteMask.setRotation(this._line.rotation);
    this._noteMask.clear();
    const rectWidth = this._line.displayWidth;
    const rectHeight = this._scene.sys.canvas.width ** 2 + this._scene.sys.canvas.height ** 2;
    this._noteMask.fillRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
  }

  calculateHeight(beat: number) {
    return this._data.eventLayers.reduce(
      (acc, _, i) =>
        acc + this.handleSpeed(beat, i, this._data.eventLayers[i]?.speedEvents, this._curSpeed),
      0,
    );
  }

  addNote(note: PlainNote | LongNote) {
    this._notes.push(note);
    [this._tapContainer, this._holdContainer, this._flickContainer, this._dragContainer][
      note.note.type - 1
    ].add(note);
  }

  setParent(parent: Line) {
    this._parent = parent;
  }

  public get notes() {
    return this._notes;
  }

  public get data() {
    return this._data;
  }

  public get x() {
    return this._line.x;
  }

  public get y() {
    return this._line.y;
  }

  public get rotation() {
    return this._line.rotation;
  }

  public get vector() {
    return new Phaser.Math.Vector2(Math.cos(this._line.rotation), Math.sin(this._line.rotation));
  }

  public get alpha() {
    return this._line.alpha;
  }

  public get elements() {
    return [
      this._line,
      this._holdContainer,
      this._dragContainer,
      this._tapContainer,
      this._flickContainer,
    ];
  }

  setVisible(visible: boolean) {
    [
      !this._data.attachUI ? this._line : undefined,
      this._flickContainer,
      this._tapContainer,
      this._dragContainer,
      this._holdContainer,
    ].forEach((obj) => {
      obj?.setVisible(visible);
    });
  }
}