let CELLSIZE = 32;
let GameDimR = 10;
let GameDimC = 10;
const MAZESIZE = 50;
const SOUNDVOLUME = 0.15;
const floor = Math.floor;
var songBgm = {songData: [{ i: [0, 0, 140, 0, 0, 0, 140, 0, 0, 255, 158, 158, 158, 0, 0, 0, 0, 51, 2, 1, 2, 58, 239, 0, 32, 88, 1, 157, 2 ],p: [1,1,1,1],c: [{n: [161,,,,,,,,,,,,,,,,163,,,,,,,,159],f: []}]},{ i: [0, 91, 128, 0, 0, 95, 128, 12, 0, 0, 12, 0, 72, 0, 0, 0, 0, 0, 0, 0, 2, 255, 0, 0, 32, 83, 3, 130, 4 ],p: [1,1,2,1],c: [{n: [144,,151,,149,,147,,146,,147,,146,,144,,144,,151,,149,,147,,146,,147,,146,,144],f: []},{n: [156,,163,,161,,159,,158,,159,,158,,156,,156,,163,,161,,159,,158,,159,,158,,168],f: []}]},{ i: [0, 16, 133, 0, 0, 28, 126, 12, 0, 0, 2, 0, 60, 0, 0, 0, 0, 0, 0, 0, 2, 91, 0, 0, 32, 47, 3, 157, 2 ],p: [1,2,1,2],c: [{n: [144,,151,,149,,147,,146,,147,,146,,144,,144,,151,,149,,147,,146,,147,,146,,144],f: []},{n: [168,,175,,173,,171,,170,,171,,170,,168,,168,,175,,173,,171,,170,,171,,170,,168],f: []}]},{ i: [0, 255, 116, 79, 0, 255, 116, 0, 83, 0, 4, 6, 69, 52, 0, 0, 0, 0, 0, 0, 2, 14, 0, 0, 32, 0, 0, 0, 0 ],p: [1,1,1,1],c: [{n: [144,,151,,149,,147,,146,,147,,146,,144,,144,,151,,149,,147,,146,,147,,146,,144,,,159,,,,159,,,,159,,,,,,,,,,,,159,,159],f: []}]},],rowLen: 8269,   patternLen: 32,  endPattern: 3,  numChannels: 4  };
class E{
    constructor(game,pos){
        this.game = game;
        this.pos = G.Point(pos);
        this.sprite = G.getEmojiSprite(`E`,CELLSIZE,1.1);
        this.life = 1;
    }
    update(t){

    }
    draw(ctx){
        ctx.drawImage(this.sprite,this.pos.x - this.sprite.w/2,this.pos.y - this.sprite.h/2);
    }
}
class CPlayer {
    constructor() {
        this.mOscillators = [
            this.osc_sin,
            this.osc_square,
            this.osc_saw,
            this.osc_tri
        ];
        this.mSong = null;
        this.mLastRow = 0;
        this.mCurrentCol = 0;
        this.mNumWords = 0;
        this.mMixBuf = null;
    }
    osc_sin(value) {
        return Math.sin(value * 6.283184);
    }
    osc_saw(value) {
        return 2 * (value % 1) - 1;
    }
    osc_square(value) {
        return (value % 1) < 0.5 ? 1 : -1;
    }
    osc_tri(value) {
        const v2 = (value % 1) * 4;
        if (v2 < 2) return v2 - 1;
        return 3 - v2;
    }
    getnotefreq(n) {
        return 0.003959503758 * (2 ** ((n - 128) / 12));
    }
    createNote(instr, n, rowLen) {
        const osc1 = this.mOscillators[instr.i[0]];
        const o1vol = instr.i[1];
        const o1xenv = instr.i[3] / 32;
        const osc2 = this.mOscillators[instr.i[4]];
        const o2vol = instr.i[5];
        const o2xenv = instr.i[8] / 32;
        const noiseVol = instr.i[9];
        const attack = instr.i[10] * instr.i[10] * 4;
        const sustain = instr.i[11] * instr.i[11] * 4;
        const release = instr.i[12] * instr.i[12] * 4;
        const releaseInv = 1 / release;
        const expDecay = -instr.i[13] / 16;
        let arp = instr.i[14];
        const arpInterval = rowLen * (2 ** (2 - instr.i[15]));
        const noteBuf = new Int32Array(attack + sustain + release);
        let c1 = 0, c2 = 0;
        let o1t = 0;
        let o2t = 0;
        for (let j = 0, j2 = 0; j < attack + sustain + release; j++, j2++) {
            if (j2 >= 0) {
                arp = (arp >> 8) | ((arp & 255) << 4);
                j2 -= arpInterval;
                o1t = this.getnotefreq(n + (arp & 15) + instr.i[2] - 128);
                o2t = this.getnotefreq(n + (arp & 15) + instr.i[6] - 128) * (1 + 0.0008 * instr.i[7]);
            }
            let e = 1;
            if (j < attack) {
                e = j / attack;
            } else if (j >= attack + sustain) {
                e = (j - attack - sustain) * releaseInv;
                e = (1 - e) * (3 ** (expDecay * e));
            }
            c1 += o1t * e ** o1xenv;
            let rsample = osc1(c1) * o1vol;
            c2 += o2t * e ** o2xenv;
            rsample += osc2(c2) * o2vol;
            if (noiseVol) {
                rsample += (2 * Math.random() - 1) * noiseVol;
            }
            noteBuf[j] = (80 * rsample * e) | 0;
        }
        return noteBuf;
    }
    initGenBuffer(song,context,callback){
        this.init(song);
        var loop = ()=>{
            var done = this.generate();
            if(done == 1){
                var buffer = this.createAudioBuffer(context);
                return callback(buffer);
            }
            else{
                requestAnimationFrame(loop);
            }
        }
        requestAnimationFrame(loop);
    }
    init(song) {
        this.mSong = song;
        this.mLastRow = song.endPattern;
        this.mCurrentCol = 0;
        this.mNumWords = song.rowLen * song.patternLen * (this.mLastRow + 1) * 2;
        this.mMixBuf = new Int32Array(this.mNumWords);
    }
    generate() {
        let i, j, b, p, row, col, n, cp, k, t, lfor, e, x, rsample, rowStartSample, f, da;
        const chnBuf = new Int32Array(this.mNumWords);
        const instr = this.mSong.songData[this.mCurrentCol];
        const rowLen = this.mSong.rowLen;
        const patternLen = this.mSong.patternLen;
        let low = 0, band = 0, high;
        let lsample, filterActive = false;
        const noteCache = [];
        for (p = 0; p <= this.mLastRow; ++p) {
            cp = instr.p[p];
            for (row = 0; row < patternLen; ++row) {
                const cmdNo = cp ? instr.c[cp - 1].f[row] : 0;
                if (cmdNo) {
                    instr.i[cmdNo - 1] = instr.c[cp - 1].f[row + patternLen] || 0;
                    if (cmdNo < 17) {
                        noteCache.length = 0;
                    }
                }
                const oscLFO = this.mOscillators[instr.i[16]];
                const lfoAmt = instr.i[17] / 512;
                const lfoFreq = (2 ** (instr.i[18] - 9)) / rowLen;
                const fxLFO = instr.i[19];
                const fxFilter = instr.i[20];
                const fxFreq = instr.i[21] * 43.23529 * 3.141592 / 44100;
                const q = 1 - instr.i[22] / 255;
                const dist = instr.i[23] * 1e-5;
                const drive = instr.i[24] / 32;
                const panAmt = instr.i[25] / 512;
                const panFreq = 6.283184 * (2 ** (instr.i[26] - 9)) / rowLen;
                const dlyAmt = instr.i[27] / 255;
                const dly = instr.i[28] * rowLen & ~1;  
                rowStartSample = (p * patternLen + row) * rowLen;
                for (col = 0; col < 4; ++col) {
                    n = cp ? instr.c[cp - 1].n[row + col * patternLen] : 0;
                    if (n) {
                        if (!noteCache[n]) {
                            noteCache[n] = this.createNote(instr, n, rowLen);
                        }
                        const noteBuf = noteCache[n];
                        for (j = 0, i = rowStartSample * 2; j < noteBuf.length; j++, i += 2) {
                          chnBuf[i] += noteBuf[j];
                        }
                    }
                }
                for (j = 0; j < rowLen; j++) {
                    k = (rowStartSample + j) * 2;
                    rsample = chnBuf[k];
                    if (rsample || filterActive) {
                        f = fxFreq;
                        if (fxLFO) {
                            f *= oscLFO(lfoFreq * k) * lfoAmt + 0.5;
                        }
                        f = 1.5 * Math.sin(f);
                        low += f * band;
                        high = q * (rsample - band) - low;
                        band += f * high;
                        rsample = fxFilter == 3 ? band : fxFilter == 1 ? high : low;
                        if (dist) {
                            rsample *= dist;
                            rsample = rsample < 1 ? rsample > -1 ? this.osc_sin(rsample * .25) : -1 : 1;
                            rsample /= dist;
                        }
                        rsample *= drive;
                        filterActive = rsample * rsample > 1e-5;
                        t = Math.sin(panFreq * k) * panAmt + 0.5;
                        lsample = rsample * (1 - t);
                        rsample *= t;
                    } else {
                        lsample = 0;
                    }
                    if (k >= dly) {
                        lsample += chnBuf[k - dly + 1] * dlyAmt;
                        rsample += chnBuf[k - dly] * dlyAmt;
                    }
                    chnBuf[k] = lsample | 0;
                    chnBuf[k + 1] = rsample | 0;
                    this.mMixBuf[k] += lsample | 0;
                    this.mMixBuf[k + 1] += rsample | 0;
                }
            }
        }
        this.mCurrentCol++;
        return this.mCurrentCol / this.mSong.numChannels;
    }
    createAudioBuffer(context) {
        const buffer = context.createBuffer(2, this.mNumWords / 2, 44100);
        for (let i = 0; i < 2; i++) {
            const data = buffer.getChannelData(i);
            for (let j = i; j < this.mNumWords; j += 2) {
                data[j >> 1] = this.mMixBuf[j] / 65536;
            }
        }
        return buffer;
    }
    createWave() {
        const headerLen = 44;
        const l1 = headerLen + this.mNumWords * 2 - 8;
        const l2 = l1 - 36;
        const wave = new Uint8Array(headerLen + this.mNumWords * 2);
        wave.set([
            82, 73, 70, 70, 
            l1 & 255, (l1 >> 8) & 255, (l1 >> 16) & 255, (l1 >> 24) & 255,
            87, 65, 86, 69, 
            102, 109, 116, 32, 
            16, 0, 0, 0, 
            1, 0, 
            2, 0, 
            68, 172, 0, 0, 
            16, 177, 2, 0, 
            4, 0, 
            16, 0, 
            100, 97, 116, 97, 
            l2 & 255, (l2 >> 8) & 255, (l2 >> 16) & 255, (l2 >> 24) & 255
        ]);
        for (let i = 0, idx = headerLen; i < this.mNumWords; ++i) {
            let y = this.mMixBuf[i];
            y = y < -32767 ? -32767 : (y > 32767 ? 32767 : y);
            wave[idx++] = y & 255;
            wave[idx++] = (y >> 8) & 255;
        }
        return wave;
    }
    getData(t, n) {
        const i = 2 * Math.floor(t * 44100);
        const d = new Array(n);
        for (let j = 0; j < 2 * n; j += 1) {
            const k = i + j;
            d[j] = t > 0 && k < this.mMixBuf.length ? this.mMixBuf[k] / 32768 : 0;
        }
        return d;
    }
}
class SoundSystem{
    constructor(autostart = true){
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioContextSingleFire = new (window.AudioContext || window.webkitAudioContext)();
        this.buffer1 = this.generateShootingSound();
        this.buffer2 = this.generateExplosion();
        var cplayer = new CPlayer();
        var cplayer2 = new CPlayer();
        this.bgmTime = 0;
        this.pausedTime = 0;
        this.startTime = 0;
        cplayer.initGenBuffer(songBgm, this.audioContext,(buffer)=>{
            this.bgmBuffer = buffer;
            if(autostart) this.startBgm();
        });
    }
    generateShootingSound() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.3; 
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() - 0.5) * 2;
        }
        const attackTime = 0.01; 
        const decayTime = 0.1;  
        const sustainLevel = 0.2; 
        const releaseTime = duration - attackTime - decayTime; 
        for (let i = 0; i < data.length; i++) {
            let time = i / sampleRate;
            if (time < attackTime) {
                data[i] *= time / attackTime; 
            } else if (time < attackTime + decayTime) {
                data[i] *= 1 - (time - attackTime) / decayTime * (1 - sustainLevel); 
            } else if (time > duration - releaseTime) {
                data[i] *= (duration - time) / releaseTime; 
            }
        }
        for (let i = 0; i < data.length; i++) {
            let time = i / sampleRate;
            
            data[i] *= Math.sin(2 * Math.PI * time * (440 + Math.random() * 100)); 
        }
        return buffer;
    }
    generateSound() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.01; 
        const frequency = 10; 
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
        }
        return buffer;
    }
    generateExplosion() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.5; 
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1; 
        }
        const attackTime = 0.05; 
        const decayTime = 0.2; 
        const sustainLevel = 0.0; 
        const releaseTime = duration - attackTime - decayTime; 
        for (let i = 0; i < data.length; i++) {
            let time = i / sampleRate;
            if (time < attackTime) {
                data[i] *= time / attackTime; 
            } else if (time < attackTime + decayTime) {
                data[i] *= 1 - (time - attackTime) / decayTime * (1 - sustainLevel); 
            } else if (time > duration - releaseTime) {
                data[i] *= (duration - time) / releaseTime; 
            }
        }
        return buffer;
    }
    playS1(){
        const source = this.audioContextSingleFire.createBufferSource();
        source.buffer = this.buffer1;
        source.connect(this.audioContextSingleFire.destination);
        source.start();
    }
    playS2(){
        const source = this.audioContextSingleFire.createBufferSource();
        source.buffer = this.buffer2;
        source.connect(this.audioContextSingleFire.destination);
        source.start();
    }
    startBgm(id = 1){
        if(this.bgmsource){
            this.bgmsource.stop();
            this.bgmsource = null;
        }
        if(this.bgmBuffer){
            this.bgmsource = this.audioContext.createBufferSource();
            this.bgmsource.buffer = id==1 ? this.bgmBuffer : this.bgm2Buffer;
            this.bgmsource.connect(this.audioContext.destination);
            this.bgmsource.loop = true;
            this.bgmsource.start(0, this.pausedTime);
            this.startTime = this.audioContext.currentTime - this.pausedTime;
        }
    }
    stopBgm(id){
        if(this.bgmsource){
            this.pausedTime = this.audioContext.currentTime - this.startTime;
            this.bgmsource.stop();
            this.bgmsource = null;
        }
    }
}
class G{
    static makeCanvas(w=0,h=0){
        let c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.w=w;
        c.h=h;
        c.ctx = c.getContext('2d');
        c.center = {x: w/2,y:h/2}
        c.clear = ()=>{
            c.ctx.clearRect(0,0,w,h);
        }
        c.fill = (color)=>{
            c.ctx.fillStyle = color;
            c.ctx.fillRect(0,0,w,h);
        }
        c.fillPatern = (img)=>{
            const pattern = c.ctx.createPattern(img, "repeat");
            c.ctx.fillStyle = pattern;
            c.ctx.fillRect(0, 0, w, h);
        }
        return c;
    }
    static GenTable(rows,cols){
        var html = ``;
        for(let i = 0 ; i < rows ; i++){
            html += `<tr>`;
            for(let j = 0 ; j < cols;j++){
                html += `<td></td>`;
            }
            html += `</tr>`;
        }
        var table = document.createElement('table');
        table.innerHTML = html;
        var entities = [];
        var trs = table.querySelectorAll('tr');
        for(let i = 0 ; i < trs.length; i++){
            var tds = trs[i].querySelectorAll('td');
            tds.forEach(x=> x.html = (html)=>x.innerHTML=html);
            entities[i] = [...tds];
        }
        table.entities = entities;
        return table;
    }
    static Point(pos){
        return new Point(pos);
    }
    static getEmojiSprite(emoji,size,factor = 1.3, color = '#000', font = 'sans-serif'){
        let canvas = G.makeCanvas(size,size);
        var ctx = canvas.ctx;
        ctx.font = `${size/factor}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(emoji,size/2, size*1.1/2);
        return canvas;
    }
    static getTextSprite(text,size, color,  factor = 0.8, font = 'sans-serif'){
        text = text.toUpperCase();
        let canvas = G.makeCanvas(size * text.length, size);
        for(let i = 0 ; i < text.length;i++){
            var ls = G.getEmojiSprite(text[i],size,factor, color, font);
            canvas.ctx.drawImage(ls,i * size,0);
        }
        return canvas;
        
    }
    static fuseImage(canvas,canvas2,composite = 'source-atop'){
        let buffer = G.makeCanvas(canvas.width,canvas.height);
        let ctx = buffer.ctx;
        ctx.drawImage(canvas,0,0);
        ctx.globalCompositeOperation = composite;
        for(let i = 0 ; i < canvas.width/canvas2.width;i++){
            for(let j = 0 ; j < canvas.height/canvas2.height;j++){
                ctx.drawImage(canvas2,i * canvas2.width,j * canvas2.height);
            }
        }
        return buffer;
    }
    static rotateCanvas(_image,deg){
        var image = (deg % 90 != 0) ? G.prepForRotate(_image) : _image;
        var canvas = G.makeCanvas(image.width,image.height);
        var ctx = canvas.ctx;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(deg * Math.PI / 180);
        ctx.drawImage(image, -image.width / 2, -image.height / 2);
        ctx.restore();
        return canvas;
    }
    static prepForRotate(image){
        let d = Math.sqrt( Math.pow(image.width,2)+Math.pow(image.height,2));
        let buffer = G.makeCanvas(d,d);
        buffer.ctx.drawImage(image,(d - image.width) /2,(d - image.height) /2);
        return buffer;
    }
    static mirror(canvas,hor = true){
        let buffer = G.makeCanvas(canvas.width,canvas.height);
        let context = buffer.ctx;
        context.save();
        if(hor){
            context.scale(-1, 1);
            context.drawImage(canvas, 0, 0, canvas.width*-1, canvas.height);
        }
        else{
            context.scale(1, -1);
            context.drawImage(canvas, 0, 0, canvas.width, canvas.height*-1);
        }
        context.restore();
        return buffer;
    }
    static gridBG(color1 = "lightgrey",color2 = null, scale = 8, width=1){
        var canvas = G.makeCanvas(scale,scale);
        var ctx = canvas.ctx;
        ctx.fillStyle = color1;
        ctx.fillRect(0,0,scale,scale);
        if(color2 == null){
            ctx.clearRect(0,0,scale-width,scale-width);
        }
        else{
            ctx.fillStyle = color2;
            ctx.fillRect(0,0,scale-width,scale-width);
        }
        return canvas;
    }
    static Lightify(canvas,opacity){
        let buffer = G.makeCanvas(canvas.width,canvas.height);
        buffer.ctx.globalAlpha = opacity;
        buffer.ctx.drawImage(canvas,0,0);
        buffer.ctx.globalAlpha = 1;
        return buffer;
    }
    static makeDom(html){
        var h = document.createElement('div');
        h.innerHTML = html;
        return h.firstChild;
    }
    static shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]];}return array;
    }
    static repeatCanvas(canvas,r,c=0){
        if (c == 0) c = r;
        var buffer = G.makeCanvas(canvas.width * c, canvas.height * r);
        var pattern = buffer.ctx.createPattern(canvas, 'repeat');
        buffer.ctx.fillStyle = pattern;
        buffer.ctx.fillRect(0, 0, buffer.w, buffer.h);
        return buffer;
    }
    static merge(list,w,h){
        var c = G.makeCanvas(w,h);
        for(let i in list){
            c.ctx.drawImage(list[i],0,0);
        }
        return c;
    }
    static brickPattern(color1 = "#fff",color2 = "#000", r = 1){
        var canvas = G.makeCanvas(8,8);
        var ctx = canvas.ctx;
        ctx.fillStyle = color1;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = color2;
        ctx.fillRect(7,0,1,4);
        ctx.fillRect(0,3,8,1);
        ctx.fillRect(4,4,1,4);
        ctx.fillRect(0,7,8,1);
        if(r > 1){return G.repeatCanvas(canvas,r,r);}
        return canvas;
    }
    static randomPattern(color1,color2,bias = 0.3,w=8,h=8){
        var canvas = G.makeCanvas(w,h);
        var ctx = canvas.ctx;
        ctx.fillStyle = color1;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = color2;
        for(let i = 0 ; i < h ; i ++){
            for(let j = 0 ; j < w ; j++){
                if(Math.random() < bias) ctx.fillRect(j,i,1,1);
            }
        }
        return canvas;
    }
    static MakeCircle(r,stroke = null,fill = null){
        var s = G.makeCanvas(r*2+2,r*2+2);
        var ctx = s.ctx;
        ctx.beginPath();
        ctx.arc(s.width/2,s.height/2,r,0,Math.PI * 2,false);
        if(stroke != null){ctx.strokeStyle = stroke;ctx.stroke();}
        if(fill != null){ctx.fillStyle = fill;ctx.fill();}
        return s;
    }
    static movePointToward(pos,rotation,distance){
        const rRad = rotation * (Math.PI / 180);
        const vx = distance * Math.cos(rRad);
        const vy = distance * Math.sin(rRad);
        return {
            x : pos.x + vx,
            y : pos.y + vy
        }
    }
    static loadImage(url,callback){
        var img = new Image();
        img.src = url;
        img.addEventListener('load',()=>{
            callback(img);
        });
    }
    static getColor(r, g, b, a){
        if(r+g+b+a == 0){return null;}
        else if(r+g+b == 0){return '#000000';}
        else if (r > 255 || g > 255 || b > 255){return '#000000';}
        return '#' + ((r << 16) + (g << 8) + b).toString(16).padStart(6, '0');
    }
    static getColorMatrix (canvas,changefct){
        var context = canvas.getContext('2d');
        var width = canvas.width;
        var height = canvas.height;
        var imageData = context.getImageData(0, 0, width, height);
        var data = imageData.data;
        var colorMatrix = [];
        for (var i = 0; i < data.length; i += 4) {
            colorMatrix.push(
                G.getColor(
                    data[i],
                    data[i + 1],
                    data[i + 2],
                    data[i + 3]
                    )
                );
        }
        var matrix = [];
        for(let i = 0 ; i < canvas.height;i++){matrix[i] = [];}
        let c = 0, r = 0;
        for(let i = 0 ; i < colorMatrix.length;i++){
            if(c >= canvas.width){r++;c=0}
            matrix[r][c] = colorMatrix[i];
            if(changefct) matrix[r][c] = changefct(matrix[r][c]);
            c++;
        }
        return matrix;
    }
    static imgToCanvas(img){
        var c = G.makeCanvas(img.width,img.height);
        c.ctx.drawImage(img,0,0);
        return c;
    }
    static colorsMatrixToSprite(matrix,scale = 1,deform = null){
        let height = matrix.length;
        let width = Math.max(...matrix.map((row)=> row.length));
        var buffer = G.makeCanvas(width * scale,height* scale);
        var ctx = buffer.ctx;
        for(let i = 0 ; i < height;i++){
            for(let j = 0 ; j < width;j++){
                var color = matrix[i][j];
                if(deform) color = deform(color);
                if(!color || color == '') continue;
                ctx.fillStyle = color;
                ctx.fillRect(j*scale,i*scale,scale,scale);
            }
        }
        return buffer;
    }
    static crop(canvas,x,y,width,height){
        let buffer = G.makeCanvas(width,height);
        buffer.ctx.drawImage(canvas,x,y,width,height,0,0,width,height);
        return buffer;
    }
    static randomColor(){
        var letters = "0123456789ABCDEF";
        var color = "#";
        for (var i = 0; i < 6; i++) {color += letters[Math.floor(Math.random() * 16)];}
        return color; 
    }
    static cssrotateCanvasInY(canvas, degrees) {
        var buffer = G.makeCanvas(canvas.width,canvas.height);
        buffer.ctx.drawImage(canvas,0,0);
        buffer.style.transform = `rotateY(${degrees}deg)`;
        buffer.style.transformOrigin = 'center';
        buffer.style.transition = 'transform 0.5s';
        return buffer;
    }
    static zoomCanvasAlongX(canvas, zoomFactor) {
        // Create a new canvas to hold the transformed content
        const transformedCanvas = document.createElement('canvas');
        transformedCanvas.width = canvas.width;
        transformedCanvas.height = canvas.height;
        
        const ctx = transformedCanvas.getContext('2d');
        
        // Save the original state of the context
        ctx.save();
        
        // Move the origin to the center of the canvas
        ctx.translate(canvas.width / 2, canvas.height / 2);
        
        // Scale along the X axis by the zoom factor (stretch or compress)
        ctx.scale(zoomFactor, 1);
        
        // Move back the origin to the top left
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        
        // Draw the original canvas content onto the transformed context
        ctx.drawImage(canvas, 0, 0);
        
        // Restore the context to its original state
        ctx.restore();
        
        return transformedCanvas;
    }
    static rotateCanvasInY(canvas, degrees) {
        const buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        const ctx = buffer.getContext('2d');
        
        const width = canvas.width;
        const height = canvas.height;
        
        // Calculate the rotation in radians
        const angle = degrees * Math.PI / 180;
        const perspective = 400; // Change to control depth illusion
        
        // Clear buffer canvas
        ctx.clearRect(0, 0, buffer.width, buffer.height);
        
        // Loop over canvas content to apply Y-axis rotation
        for (let x = 0; x < width; x++) {
            const offset = Math.cos(angle) * (x - width / 2);
            const scale = perspective / (perspective - offset);
            
            ctx.drawImage(
                canvas,        // Source canvas
                x, 0, 1, height, // Source position and size (1-pixel slice)
                (x - width / 2) * scale + width / 2, // X position with scaling
                0, width * scale, height // Destination size with scaling
            );
        }
        
        return buffer;
    }
    static rand (a=1, b=0){ return b + (a-b)*Math.random();}
    static randInt (a=1, b=0){ return G.rand(a,b)|0;}
}
class Point{
    constructor(pos){
        this.x = pos.x;
        this.y = pos.y;
    }
    moveToward(p2,dist=1){
        var vx = this.x == p2.x ? 0 : this.x < p2.x ? dist : -dist;
        var vy = this.y == p2.y ? 0 : this.y < p2.y ? dist : -dist;
        this.x += vx;
        this.y += vy;
    }
    distance(p2){
        let distance = 0;
        distance += Math.pow((this.x - p2.x), 2);
        distance += Math.pow((this.y - p2.y), 2);
        distance = Math.sqrt(distance);
        return distance;
    }
    getAngleTo(target){
        let dx = target.x - this.x;
        let dy = target.y - this.y;
        
        let angleRadians = Math.atan2(dy, dx);
        return angleRadians * 180/Math.PI;
    }
    moveByAngle(rotation,distance){
        const rRad = rotation * (Math.PI / 180);
        const vx = distance * Math.cos(rRad);
        const vy = distance * Math.sin(rRad);
        this.x = this.x + vx;
        this.y = this.y + vy;
    }
}
class Heart extends E{
    constructor(game,pos){
        super(game,pos);
        this.sprite = G.getEmojiSprite(`💓`,CELLSIZE*0.8,1.1);
        this.animations = [
            G.getEmojiSprite(`💓`,CELLSIZE*0.8,1.1),
            G.getEmojiSprite(`💓`,CELLSIZE*0.7,1.1),
            G.getEmojiSprite(`💓`,CELLSIZE*0.6,1.1),
            G.getEmojiSprite(`💓`,CELLSIZE*0.5,1.1),
            G.getEmojiSprite(`💓`,CELLSIZE*0.6,1.1),
            G.getEmojiSprite(`💓`,CELLSIZE*0.7,1.1),
        ];
        this.currentAnimation = 0;
        this.currentAnimationFrames = 10;
    }
    update(t){
        this.currentAnimation++;
        this.sprite = this.animations[floor(this.currentAnimation/this.currentAnimationFrames)],this.rotation;
        if(this.currentAnimation > (this.animations.length-1) * this.currentAnimationFrames){
            this.currentAnimation = 0;
        }
        if(this.game && this.game.player && this.pos.distance(this.game.player.pos) < CELLSIZE/2){
            this.game.player.life += 20;
            this.game.objects = this.game.objects.filter(x=>x!=this);
        }
    }
}
class Moon{
    constructor(planet){
        this.planet = planet;
        this.sprite = G.getEmojiSprite('🌕',16, 1.1);
        this.vx = 0;
        this.vy = 1;
        this.pos = G.Point(this.planet.pos);
        this.currentPos = 0;
        this.ellipse = {
            x : this.planet.pos.x,
            y : this.planet.pos.y,
            r : this.planet.sprite.w * 1,
            d : 20*Math.PI/180,
            c : 120
        }

        // this.orbitPoints = this.getPointsOnCircle(this.planet.pos.x,this.planet.pos.y,this.planet.sprite.w * 1.5, 120);
        this.orbitPoints = this.getPointsOnOval(this.ellipse.x,this.ellipse.y,this.ellipse.r,this.ellipse.d,this.ellipse.c);
        this.pos = G.Point(this.orbitPoints[this.currentPos]);

        this.time = 0;
        this.frames = 0;
    }
    getPointsOnCircle(centerX, centerY, radius, numPoints) {
        const points = [];
        for (let i = 0; i < numPoints; i++) {
            // Calculate the angle for each point
            const angle = (2 * Math.PI * i) / numPoints;
            // Calculate the x and y coordinates for the point
            const pointX = centerX + radius * Math.cos(angle);
            const pointY = centerY + radius * Math.sin(angle);
            // Add the point to the array
            points.push({ x: pointX, y: pointY });
        }
        return points;
    }
    getPointsOnOval(centerX, centerY, radius, degreeOfOvality, numPoints) {
        const points = [];
        // Set radius for x and y based on the degree of ovality
        const r_x = radius; // Major radius (x-direction stays the same)
        const r_y = radius * degreeOfOvality; // Minor radius (stretched by d)
        for (let i = 0; i < numPoints; i++) {
            // Calculate the angle for each point
            const angle = (2 * Math.PI * i) / numPoints;
            // Calculate the x and y coordinates for the point
            const pointX = centerX + r_x * Math.cos(angle);
            const pointY = centerY + r_y * Math.sin(angle);
            // Add the point to the array
            points.push({ x: pointX, y: pointY });
        }
        return points;
    }
    update(t){
        this.frames++;
        if(this.frames > 4){
            this.frames = 0;
            this.currentPos++;
            if(this.currentPos > this.orbitPoints.length-1) this.currentPos=0;
            this.pos = G.Point(this.orbitPoints[this.currentPos]);
        }
        this.time = t;
        
    }
    draw(ctx){
        this.drawEllipse(ctx);
        ctx.drawImage(this.sprite, this.pos.x-this.sprite.w/2, this.pos.y-this.sprite.h/2);
    }
    drawEllipse(ctx){
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.ellipse(
            this.ellipse.x,
            this.ellipse.y,
            this.ellipse.r,
            this.ellipse.r * this.ellipse.d,
            0,
            0,
            2 * Math.PI
        );
        ctx.strokeStyle = "#0000ff02";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
class Planet extends E{
    constructor(game,pos){
        super(game,pos);
        this.defenceRange = CELLSIZE*8;
        this.attackPower = 1;
        this.attackSpeed = 2;
        this.attackLimit = 3;
        this.rockets = [];
        this.life = 100;

        this.defencecircle = G.MakeCircle(this.defenceRange,'#fff',null);
        this.currentAnimation = 0;
        this.animationframes = 60;
        this.animations = [
            G.getEmojiSprite('🌍',64, 1.1),
            G.getEmojiSprite('🌎',64, 1.1),
            G.getEmojiSprite('🌏',64, 1.1),
            G.getEmojiSprite('🌍',64, 1.1),
        ];
        this.sprite = this.animations[this.currentAnimation];
        this.moon = new Moon(this);
    }
    addAttrib(n,v){
        if(n == 'life'){
            this.life += v;
        }
        else if(n == 'attackLimit'){
            this.attackLimit += v;
        }
        else if(n == 'attackSpeed'){
            this.attackSpeed += v;
        }
        else if(n == 'attackPower'){
            this.attackPower += v;
        }
        else if(n == 'defenceRange'){
            this.defenceRange += v;
            this.defencecircle = G.MakeCircle(this.defenceRange,'#fff',null);
        }
    }
    update(t){
        this.moon.update(t);
        this.rockets.forEach(x=>x.update(t));
        this.currentAnimation++;
        this.sprite = this.animations[floor(this.currentAnimation/this.animationframes)];
        if(this.currentAnimation > (this.animations.length-1)*this.animationframes) this.currentAnimation = 0;
    }
    draw(ctx){
        this.moon.draw(ctx);
        ctx.drawImage(this.sprite, this.pos.x - this.sprite.w/2, this.pos.y-this.sprite.h/2);
        ctx.drawImage(this.defencecircle, this.pos.x - this.defencecircle.w/2, this.pos.y-this.defencecircle.h/2);
        this.rockets.forEach(x=>x.draw(ctx));
    }
    getCamPov(w,h){
        var ix = this.pos.x - this.sprite.w/2;
        var iy = this.pos.y - this.sprite.h/2;
        var x = ix , y = iy;
        var bufferdd = {
            w: this.game.buffer.w,
            h: this.game.buffer.h
        }
        x = Math.max(x - w/2,0);
        y = Math.max(y - h/2,0);

        if(x + w > bufferdd.w) x = bufferdd.w-w;
        if(y + h > bufferdd.h) y = bufferdd.h-h;
        
        return {x,y};
    }
    handleTouchPos(pos){
        if(this.rockets.length < this.attackLimit){
            var rocket1 = new Rocket(this,pos);
            this.rockets.push(rocket1);
        }
    }
}
const ROCKETSPRITE = G.rotateCanvas(G.getEmojiSprite('🚀',16,1.1),45);
class Rocket{
    constructor(planet,targetpos){
        this.planet = planet;
        this.targetpos = targetpos;
        this.pos = G.Point(this.planet.pos);
        this.rotation = this.pos.getAngleTo(targetpos);
        this.sprite = G.rotateCanvas(ROCKETSPRITE,this.rotation)
        this.distancecoverd = 0;
        this.life = 1;
        this.power = planet.attackPower;
        this.speed = planet.attackSpeed;

    }
    update(t){
        for(let i = 0 ; i < this.speed;i++){
            this.pos.moveByAngle(this.rotation,1);
            var target = this.planet.game.objects.find(x=>x instanceof Invader && x.pos.distance(this.pos) < this.sprite.w);
            if(target != null){
                target.life -= this.power;
                this.life = 0;
                this.planet.rockets.splice(this.planet.rockets.indexOf(this),1);
                return;
            }
        }
        this.distancecoverd += this.speed;
        if(this.distancecoverd > this.planet.defenceRange){
            this.life = 0;
            this.planet.rockets.splice(this.planet.rockets.indexOf(this),1);
        }
    }
    draw(ctx){
        ctx.drawImage(this.sprite,this.pos.x-this.sprite.w/2,this.pos.y-this.sprite.h/2);
    }

}
class Invader extends E{
    constructor(game,pos){
        super(game,pos);
        var colorCvs = G.makeCanvas(32,32);
        colorCvs.fill(G.randomColor());
        this.sprite = G.fuseImage(G.getEmojiSprite('⓭',32,1.1),colorCvs);

        this.rotation = this.pos.getAngleTo(this.game.player.pos);

        this.speed = this.game.level * 0.5;
        this.life = this.game.level *1;
        this.power = this.game.level * 5;
    }
    update(t){
        this.pos.moveByAngle(this.rotation,this.speed);
        if(this.life <= 0){
            this.game.t13killed++;
            this.game.objects.splice(this.game.objects.indexOf(this),1);
        }
        else if(this.pos.distance(this.game.player.pos) < this.sprite.w){
            this.game.player.life -= this.power;
        }
    }
    getQuadraticBezierPoints(P0, P1, P2, numPoints) {
        const points = [];
        for (let t = 0; t <= 1; t += 1 / (numPoints - 1)) {
            const x = Math.pow(1 - t, 2) * P0.x + 2 * (1 - t) * t * P1.x + Math.pow(t, 2) * P2.x;
            const y = Math.pow(1 - t, 2) * P0.y + 2 * (1 - t) * t * P1.y + Math.pow(t, 2) * P2.y;
            points.push({ x, y });
        }
        return points;
    }
    draw(ctx){
        super.draw(ctx);
    }
}
class Game{
    constructor(c){
        this.config = {
            music : false,
            sound : false,
            controls:false
        };
        this.resetBody();
        this.preLoading();
        this.windowaspect = window.innerHeight/window.innerWidth;
        if(this.windowaspect > 1){
            CELLSIZE = 16*2;
        }
        GameDimR = Math.floor(window.innerHeight/CELLSIZE) - 2.5;
        GameDimC = Math.floor(window.innerWidth/CELLSIZE)- 1;
        this.helpdom = document.createElement('div');
        document.body.innerHTML = ``;
        this.mainScene();
        return;
    }
    prepheader(){
        var headerTable = G.GenTable(2,6);
        headerTable.style.width = GameDimC * CELLSIZE + "px";
        var entities = headerTable.entities;
        
        this.healthdom = document.createElement('div');
        this.pointsdom = document.createElement('div');
        this.leveldom = document.createElement('div');
        this.timedom = document.createElement('div');

        entities[0][0].append(G.getEmojiSprite('💓',32,1.4));
        entities[1][0].append(this.healthdom);

        entities[0][1].append(G.getEmojiSprite('⓭',32,1.4));
        entities[1][1].append(this.pointsdom);

        entities[0][2].append(G.getEmojiSprite('⌛',32,1.4));
        entities[1][2].append(this.timedom);

        entities[0][4].append(`Level`);
        entities[1][4].append(this.leveldom);
        
        entities[0][5].rowSpan = 2;
        entities[0][5].append(G.getEmojiSprite('📋',40,1.4));

        entities[1][5].remove();
        entities[0][5].onclick = ()=>{this.showMenu();}

        this.header.append(headerTable);
    }
    prepFootercontrols(){
        if(this.config.controls == false){
            this.footer.innerHTML = '';
            return;
        }
        this.footer.innerHTML = '';
        var table = G.GenTable(2,3);
        table.classList.add('gamecontrolstable');
        table.style.width = GameDimC * CELLSIZE + "px";
        var entities = table.entities;
        var keys = [
            {html : '<span> <h1>w</h1> </span>', f : 'w' , r : 0 , c : 1},
            {html : '<span> <h1>s</h1> </span>', f : 's' , r : 1 , c : 1},
            {html : '<span> <h1>a</h1> </span>', f : 'a' , r : 0 , c : 0},
            {html : '<span> <h1>d</h1> </span>', f : 'd' , r : 0 , c : 2},
        ]
        keys.forEach(k=>{
            var dom = G.makeDom(k.html);
            entities[k.r][k.c].addEventListener('touchstart',(e)=> this.player.keys.keydown(k.f));
            entities[k.r][k.c].addEventListener('touchend',(e)=> this.player.keys.keyup(k.f));
            entities[k.r][k.c].addEventListener('mousedown',(e)=> this.player.keys.keydown(k.f));
            entities[k.r][k.c].addEventListener('mouseup',(e)=> this.player.keys.keyup(k.f));
            entities[k.r][k.c].append(dom) ;
            entities[k.r][k.c].style.border = '2px solid black';
            entities[k.r][k.c].style.background = 'blue';
            entities[k.r][k.c].style.color = '#fff';
        })
        entities[0][2].rowSpan = 2;
        entities[1][2].remove();
        entities[0][0].rowSpan = 2;
        entities[1][0].remove();

        this.footer.appendChild(table);

    }
    mainScene(){
        this.gameover = true;
        this.gamePased = true;
        this.resetBody();
        var canvas = G.makeCanvas(GameDimC*CELLSIZE,GameDimR*CELLSIZE);
        canvas.fill('#000');
        // var cover = this.getCover();
        // canvas.ctx.drawImage(cover,0,0, canvas.w,canvas.h);
        this.getMainMenuBg(canvas);

        this.body.append(canvas);
        this.showMenu();
    }
    showMenu(){
        this.gamePased = true;
        if(this.dialog != null){this.dialog.remove();}
        this.dialog = Object.assign(document.createElement('div'), { className: 'menuDialog'});
        
        var navItems = [];
        if(this.gameover){
            navItems.push({html : '<button >New Game</button>', f:'newgame'});
        }
        else{
            navItems.push({html : '<button >Resume</button>', f:'resume'});
            navItems.push({html : '<button >Upgrade</button>', f:'upgradeplayer'});
        }
        navItems.push(...[
            {html : '<button >Help</button>',   f:'help'},
            {html : `<button >Music ${this.config.music ? 'ON': 'OFF'}</button>`,   f:'music'},
            // {html : `<button >Controls ${this.config.controls ? 'ON': 'OFF'}</button>`,   f:'controls'},
        ]);
        if(!this.gameover){
            navItems.push({html : '<button >Quit</button>',   f:'quit'},);
        }
        var nav = G.GenTable(navItems.length,1);
        for(let i in navItems){
            var dom = G.makeDom(navItems[i].html)
            dom.style.width = `${GameDimC*CELLSIZE * 0.9}px`;
            dom.style.fontSize = `24pt`;

            nav.entities[i][0].append(dom);
            nav.entities[i][0].onclick = ()=>{
                this.ApplyMenuItem(navItems[i].f);
            }
        }
        this.dialog.append(nav);
        this.body.append(this.dialog);
    }
    upgradeplayer(){
        this.gamePased = true;
        if(this.dialog != null){this.dialog.remove();}
        this.dialog = Object.assign(document.createElement('div'), { className: 'menuDialog'});
        
        var navItems = [];
        navItems.push({html : '<button >Resume</button>', f:'resume'});
        var nav = G.GenTable(navItems.length,1);
        for(let i in navItems){
            var dom = G.makeDom(navItems[i].html)
            dom.style.width = `${GameDimC*CELLSIZE * 0.9}px`;
            dom.style.fontSize = `24pt`;
            nav.entities[i][0].append(dom);
            nav.entities[i][0].onclick = ()=>{
                this.ApplyMenuItem(navItems[i].f);
            }
        }
        var upgItems = [
            {n : 'Life', v : this.player.life, u:50 , a :'life'},
            {n : 'Range', v : this.player.defenceRange, u:10 , a :'defenceRange'},
            {n : 'Rockets', v : this.player.attackLimit, u:1 , a :'attackLimit'},
            {n : 'Rocket Speed', v : this.player.attackSpeed, u:1 , a :'attackSpeed'},
            {n : 'Rocket Power', v : this.player.attackPower, u:1 , a :'attackPower'},
        ];

        var upgTable = G.GenTable(upgItems.length,3);
        upgTable.classList.add('upgradeplayertable');
        upgTable.style.width = `${GameDimC*CELLSIZE * 0.9}px`;
        upgTable.style.fontSize = `24pt`;
        for(let i in upgItems){
            upgTable.entities[i][0].innerHTML = `<b>${upgItems[i].n}</b>`;
            upgTable.entities[i][1].innerHTML = `<b>${upgItems[i].v}</b>`;
            upgTable.entities[i][2].innerHTML = `<button><b>${upgItems[i].u}/⓭</b><button>`;
            upgTable.entities[i][2].onclick = ()=>{
                if(this.t13killed > 0){
                    this.t13killed--;
                    this.player.addAttrib(upgItems[i].a,upgItems[i].u);
                    this.healthdom.innerHTML = `${this.player.life}`;
                    this.pointsdom.innerHTML = `${this.t13killed}`;
                    this.upgradeplayer();
                }
            }
        }
        this.dialog.append(nav);
        this.dialog.append(upgTable);
        this.body.append(this.dialog);
    }
    newGame(){
        this.resetBody();
        this.prepheader();
        this.prepFootercontrols();
        // document.body.requestFullscreen();
        this.windowaspect = window.innerHeight/window.innerWidth;
        this.objects = [];
        this.level = 1;
        this.t13killed = 0;
        this.t13Spawned = 0;
        var r = 40 + this.level * 5;
        var c = 40 + this.level * 5;

        this.canvas = G.makeCanvas(GameDimC*CELLSIZE,GameDimR*CELLSIZE);
        this.buffer = G.makeCanvas(GameDimC*CELLSIZE,GameDimR*CELLSIZE);
        this.spacebg = G.randomPattern('#000','#fff',0.001,this.buffer.w,this.buffer.h);

        this.player = new Planet(this,{x:this.buffer.w/2,y:this.buffer.h/2});
        
        this.objects = [
            this.player
        ];
        this.newLevel(this.level);
        window.addEventListener('keyup',(e)=>{
            if(e.key=='Escape'){
                this.showMenu();
            }
        })
    }
    newLevel(level){
        this.timeremaining = 13*60;
        this.timeup = false;
        this.gameover = false;
        this.gamePased = false;
        this.level = level;
        this.spawnCounter = 0;
        this.leveldom.innerHTML = this.level;
        this.objects = [
            this.player
        ];
        this.body.innerHTML = '';
        this.body.appendChild(this.canvas);
        this.body.appendChild(this.helpdom);
        this.update(0);
        this.events = {
            touchstart : false
        }
        this.touchPos = null;
        this.canvas.addEventListener('mousedown', (e) => handleStart(e));
        this.canvas.addEventListener('mouseup', () => handleEnd());
        this.canvas.addEventListener('mousemove', (e) => handleMove(e));
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => handleStart(e));
        this.canvas.addEventListener('touchend', () => handleEnd());
        this.canvas.addEventListener('touchmove', (e) => handleMove(e));

        var handleEnd =()=>{this.touchPos = null;}
        var handleStart = (e)=>{
            const touch = e.touches ? e.touches[0] : e;
            this.touchPos = getTp(touch);
        }
        var handleMove = (e)=>{
            if (this.touchPos) {
                const touch = e.touches ? e.touches[0] : e; // Handle single touch or mouse event
                const tp2 = getTp(touch);
                this.touchPos = tp2;
            }
        }
        var getTp = (e)=>{
            var rect = this.canvas.getBoundingClientRect();
            var x = e.clientX - rect.left + window.scrollX;
            var y = e.clientY - rect.top + window.scrollY;
            return { x: x, y: y };
        }
        return;
    }
    preLoading(){
        var about = G.makeDom(`<div>Loading....</div>`);
        this.body.append(about);
    }
    LevelEndScene(){
        this.gamePased = true;
        if(this.dialog != null){this.dialog.remove();}
        this.dialog = Object.assign(document.createElement('div'), { className: 'menuDialog'});
        this.dialog.innerHTML = `<h1>Well Done<h1><h2> Level ${this.level} finished</h2>`;
        var nextLevelButton = G.makeDom(`<button id="nextLevel"><h3>Next Level</h3></button>`);
        nextLevelButton.onclick = ()=>{
            this.newLevel(this.level+1);
        }
        this.dialog.append(nextLevelButton);
        this.body.append(this.dialog);
    }
    handleClick(e){
        if(this.dialog != null){this.dialog.remove();}
        var rect = this.canvas.getBoundingClientRect();
        var x = e.clientX - rect.left + window.scrollX;
        var y = e.clientY - rect.top + window.scrollY;
        x = Math.floor(x/CELLSIZE) * CELLSIZE + CELLSIZE / 2;
        y = Math.floor(y/CELLSIZE) * CELLSIZE + CELLSIZE / 2;
        var pos = {x:x,y:y};
        this.mousePos = {x:x-CELLSIZE/2,y:y-CELLSIZE/2};
        return;
    }
    resetBody(){
        var div_w_class = `<div class='_class_'></div>`;
        this.layout = G.makeDom(div_w_class.replace('_class_','layout'));
        this.header = G.makeDom(div_w_class.replace('_class_','header'));
        this.body = G.makeDom(div_w_class.replace('_class_','body'));
        this.footer = G.makeDom(div_w_class.replace('_class_','footer'));
        this.layout.appendChild(this.header);
        this.layout.appendChild(this.body);
        this.layout.appendChild(this.footer);
        document.body.innerHTML = ``;
        document.body.appendChild(this.layout);
    }
    gameOverScene(){
        this.gamePased = true;
        this.gameover = true;
        if(this.dialog != null){this.dialog.remove();}
        this.dialog = Object.assign(document.createElement('div'), { className: 'menuDialog'});
        this.dialog.style.width = `${GameDimC*CELLSIZE}px`;
        this.dialog.style.height = `${GameDimR*CELLSIZE * 0.8}px`;
        this.dialog.innerHTML = `<h1>Game Over</h1>`;
        if(this.timeup){
            this.dialog.innerHTML = `<h2>Time Up</h2>`;
        }
        var button = G.makeDom(`<button id="nextLevel"><h2>New Game</h2></button>`);
        button.style.width = `${GameDimC*CELLSIZE * 0.90}px`;
        button.onclick = ()=>{
            this.newGame();
        }
        this.dialog.append(button);
        this.body.append(this.dialog);
    }
    ApplyMenuItem(item){
        if(item == 'upgradeplayer'){
            this.upgradeplayer();
        }
        if(item == 'newgame'){
            this.gamePased = false;
            this.gameover = false;
            this.newGame();
        }
        else if(item == 'resume'){
            this.gamePased = false;
            this.dialog.remove();
            this.update(this.time);
        }
        else if(item == 'controls'){
            this.config.controls = !this.config.controls;
            this.prepFootercontrols();
            this.showMenu();
            this.update(this.time);
        }
        else if(item == 'music'){
            if(!this.SoundSystem){
                this.SoundSystem = new SoundSystem();
            }
            var currentval = this.config.music;
            if(currentval){
                this.SoundSystem.stopBgm();
            }
            else{
                this.SoundSystem.startBgm();
            }
            this.config.music = !this.config.music;
            this.dialog.remove();
            this.showMenu();
        }
        else if(item == 'quit'){
            if(document.webkitIsFullScreen) document.exitFullscreen();
            this.gamePased = true;
            this.gameover = true;
            this.dialog.remove();
            this.mainScene();
        }
        else if(item == `help`){
            this.gamePased = true;
            if(this.dialog != null){this.dialog.remove();}
            this.dialog = Object.assign(document.createElement('div'), { className: 'menuDialog'});
            this.dialog.style.width = `${GameDimC*CELLSIZE}px`;
            var h2 = `
                <div class="helpDiv">
                    <h2>Help</h2>
                    <p>Earth is being invaded by the ⓭ </p>
                    <p>They have sent colored ships with ⓭ on them</p>
                    <p>You control the missle station in earth</p>
                    <p>DEFEND your HOME</p>
                    <p>Upgrade your station from menu when you have killed enough ⓭</p>
                    <p></p>
                </div>
            `;
            var mdom = G.makeDom('<button>Menu</button>');
            mdom.onclick = ()=>{
                this.gamePased = false;
                this.dialog.remove();
                this.showMenu();
                // this.update(this.time);
            }
            this.dialog.innerHTML += h2;
            var helpDiv = this.dialog.querySelector('.helpDiv');
            helpDiv.style['overflow-y'] = `auto`;
            helpDiv.style.height = GameDimR*CELLSIZE * 0.8  + `px`;
            this.dialog.append(mdom);
            this.body.append(this.dialog);
        }
    }
    parseNum(v){
        if(v >= 10000000000) return `${(v/10000000000).toFixed(1)}T`;
        if(v >= 100000000) return `${(v/100000000).toFixed(1)}B`;
        if(v >= 1000000) return `${(v/1000000).toFixed(1)}M`;
        if(v >= 1000) return `${(v/1000).toFixed(1)}k`;
        return `${v}`;
    }
    updateBuffer(){
        this.buffer.clear();
        this.buffer.ctx.drawImage(this.spacebg,0,0);

        this.objects.sort((a, b) => {return a.pos ? a.pos?.y : Infinity - b.pos ? b.pos?.y : Infinity;});
        this.objects.forEach(x=> x.draw(this.buffer.ctx));
        var w = this.canvas.w;
        var h = this.canvas.h;
        var cxy = this.player.getCamPov(w,h);
        return G.crop(this.buffer,cxy.x,cxy.y,w,h);
    }
    update(t){
        if(this.gamePased == true){return;}
        if(this.gameover == true) return this.gameOverScene();
        this.spawn13s(t);
        this.objects.forEach(x=> x.update(t));
        if(this.player.life<=0){
            return this.gameOverScene();
        }
        var crop = this.updateBuffer();
        this.canvas.clear();
        this.canvas.ctx.drawImage(crop,0,0);
        this.healthdom.innerHTML = `${this.player.life}`;
        this.pointsdom.innerHTML = `${this.t13killed}`;
        this.timedom.innerHTML = `${this.parseTime(t/1000)}`;

        if(this.touchPos){
            this.player.handleTouchPos(this.touchPos);
            this.touchPos = null;
        }
        this.time = t;
        requestAnimationFrame(newtime=>this.update(newtime));
    }
    spawn13s(t){
        this.spawnCounter++;
        if(this.spawnCounter >= (13-this.level)*6 ) {
            var randomX = G.randInt(CELLSIZE,this.canvas.w-CELLSIZE);
            var randomY = G.randInt(CELLSIZE,this.canvas.h-CELLSIZE);
            if(Math.random()>0.5){
                randomX = 0
            }
            else {
                randomY = 0
            }
            var invader = new Invader(this,{x:randomX,y:randomY});
            this.objects.push(invader);
            this.t13Spawned++;
            this.spawnCounter=0;

            if(this.t13Spawned >= 13){
                this.t13Spawned = 0;
                this.level += 1;
                this.leveldom.innerHTML = this.level;
                this.spawnCounter = -(50-this.level)*100;
            }
        }
    }
    parseTime(s){
        let m = Math.floor(s / 60);
        let h = Math.floor(m / 60);
        h = h == 0 ? '' : h < 10 ? `0${h}:` : `${h}:`;
        m = Math.floor(m % 60);
        m = m == 0 ? '' : m < 10 ? `0${m}:` : `${m}:`;
        s = Math.floor(s % 60);
        return `${h}${m}${s}`;
    }
    getThumbnail(){
        var canvas = G.makeCanvas(320,320);
        var space = G.randomPattern('#000','#fff',0.001,500,500);
        var gamename = G.getTextSprite(`13 INVADERS`,   16, `#fff`, 1.5, 'cursive');
        var pos = G.Point({x:canvas.w/2,y:canvas.h/2});
        var planet = new Planet(this,pos);
        canvas.fillPatern(space);
        planet.draw(canvas.ctx);
        canvas.ctx.drawImage(gamename,canvas.w/2-gamename.w/2,canvas.h-gamename.h*2);
        return canvas;
    }
    getCover(){
        var canvas = G.makeCanvas(800,500);
        var space = G.randomPattern('#000','#fff',0.001,500,500);
        var gamename = G.getTextSprite(`13 INVADERS`,   32, `#fff`, 1.5, 'cursive');
        var pos = G.Point({x:canvas.w/2,y:canvas.h/2});
        var planet = new Planet(this,pos);
        canvas.fillPatern(space);
        planet.draw(canvas.ctx);
        canvas.ctx.drawImage(gamename,0,canvas.h-gamename.h*2);
        return canvas;
    }
    getMainMenuBg(canvas){
        var credit = G.getTextSprite(`BY MHMDJAWADZD`,   16, `#fff`, 1.5, 'cursive');
        var space = G.randomPattern('#000','#fff',0.001,500,500);
        canvas.fillPatern(space);
        var pos = G.Point({x:canvas.w/2,y:canvas.h/2});
        var planet = new Planet(this,pos);
        function update(t){
            canvas.fillPatern(space);
            planet.update(t);
            planet.draw(canvas.ctx);
            canvas.ctx.drawImage(credit, 0,  canvas.h - credit.h);
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }
    fortesting(){
        var canvas = G.makeCanvas(500,500);
        var space = G.randomPattern('#000','#fff',0.001,500,500);
        canvas.fillPatern(space);
        document.body.append(canvas);

        var pos = G.Point({x:canvas.w/2,y:canvas.h/2});

        var planet = new Planet(this,pos);
        var invader = new Invader(this,{x:pos.x-100,y:pos.y});

        function update(t){
            canvas.fillPatern(space);
            planet.update(t);
            invader.update(t);
            planet.draw(canvas.ctx);
            invader.draw(canvas.ctx);
            requestAnimationFrame(update);
        }
        
        document.body.append(canvas);
        requestAnimationFrame(update);  



    }
}
document.addEventListener('DOMContentLoaded', function () {
    window.game = new Game("");
}, false);