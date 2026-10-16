import React from 'react';
import { SPEED_RATES } from './constants';

export const AudioManager = ({
  audioDSP,
  playbackRate,
  changeSpeed
}) => {
  const {
    is8DEnabled,
    setIs8DEnabled,
    eightDSpeed,
    setEightDSpeed,
    bassGain,
    setBassGain,
    vocalGain,
    setVocalGain,
    stereoPan,
    setStereoPan,
    is3DSpacial,
    setIs3DSpacial,
    spatialReverb,
    setSpatialReverb,
    currentPanPos
  } = audioDSP;

  const visualizerX = ((currentPanPos + 1) / 2) * 100;

  return (
    <div className="audio-manager-container glass-card">
      <div className="tab-title-bar">
        <h2>🎛️ Bảng Tùy Chỉnh Âm Thanh & Hiệu Ứng DSP</h2>
        <p className="status-text">
          Đã kích hoạt Web Audio DSP. Hãy đeo tai nghe để trải nghiệm âm thanh vòm 8D và Bass Boost thực tế!
        </p>
      </div>

      <div className="dsp-grid">
        {/* CARD 1: 8D SURROUND SOUND */}
        <div className={`dsp-card glass-card ${is8DEnabled ? 'active-dsp' : ''}`}>
          <div className="dsp-card-header">
            <h3>🎧 Giả Lập Âm Thanh Vòm 8D</h3>
            <button
              className={`dsp-toggle-btn glow-hover-btn ${is8DEnabled ? 'active' : ''}`}
              onClick={() => setIs8DEnabled(!is8DEnabled)}
            >
              {is8DEnabled ? '🟢 BẬT 8D' : '⚪ TẮT'}
            </button>
          </div>

          <div className="radar-8d-box">
            <div className="radar-earphones">🎧</div>
            <div
              className={`radar-sound-dot ${is8DEnabled ? 'pulsing' : ''}`}
              style={{ left: `${visualizerX}%` }}
            />
            <div className="radar-channel-label left">TRÁI (L)</div>
            <div className="radar-channel-label right">PHẢI (R)</div>
          </div>

          <div className="dsp-control-group">
            <label>Tốc độ xoay 8D quanh đầu: <strong>{(eightDSpeed * 10).toFixed(1)}x</strong></label>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={eightDSpeed}
              disabled={!is8DEnabled}
              onChange={(e) => setEightDSpeed(Number(e.target.value))}
            />
          </div>
        </div>

        {/* CARD 2: BASS BOOSTER */}
        <div className="dsp-card glass-card">
          <div className="dsp-card-header">
            <h3>🔊 Tăng Cường Bass (Bass Boost)</h3>
            <span className="dsp-value-badge">+{bassGain} dB</span>
          </div>

          <div className="preset-btn-group">
            <button className={`preset-chip ${bassGain === 0 ? 'active' : ''}`} onClick={() => setBassGain(0)}>Gốc</button>
            <button className={`preset-chip ${bassGain === 6 ? 'active' : ''}`} onClick={() => setBassGain(6)}>Ấm (+6dB)</button>
            <button className={`preset-chip ${bassGain === 12 ? 'active' : ''}`} onClick={() => setBassGain(12)}>Trầm (+12dB)</button>
            <button className={`preset-chip ${bassGain === 18 ? 'active' : ''}`} onClick={() => setBassGain(18)}>Siêu Bass (+18dB)</button>
          </div>

          <div className="dsp-control-group">
            <label>Cường độ âm trầm (Bass):</label>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={bassGain}
              onChange={(e) => setBassGain(Number(e.target.value))}
            />
          </div>
        </div>

        {/* CARD 3: VOCAL BOOSTER */}
        <div className="dsp-card glass-card">
          <div className="dsp-card-header">
            <h3>🎤 Điều Chỉnh Âm Giọng (Vocal)</h3>
            <span className="dsp-value-badge">{vocalGain > 0 ? `+${vocalGain}` : vocalGain} dB</span>
          </div>

          <div className="preset-btn-group">
            <button className={`preset-chip ${vocalGain === -8 ? 'active' : ''}`} onClick={() => setVocalGain(-8)}>Giảm Lời (-8dB)</button>
            <button className={`preset-chip ${vocalGain === 0 ? 'active' : ''}`} onClick={() => setVocalGain(0)}>Chuẩn (0dB)</button>
            <button className={`preset-chip ${vocalGain === 8 ? 'active' : ''}`} onClick={() => setVocalGain(8)}>Nổi Bật Ca Sĩ (+8dB)</button>
          </div>

          <div className="dsp-control-group">
            <label>Cường độ giọng ca sĩ:</label>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={vocalGain}
              onChange={(e) => setVocalGain(Number(e.target.value))}
            />
          </div>
        </div>

        {/* CARD 4: STEREO BALANCE */}
        <div className="dsp-card glass-card">
          <div className="dsp-card-header">
            <h3>🎚️ Cân Bằng Stereo L/R</h3>
            <button className="reset-stereo-btn glow-hover-btn" onClick={() => setStereoPan(0)}>🎯 Center</button>
          </div>

          <div className="dsp-control-group">
            <label>Vị trí loa: <strong>{stereoPan < 0 ? `Trái ${(Math.abs(stereoPan) * 100).toFixed(0)}%` : stereoPan > 0 ? `Phải ${(stereoPan * 100).toFixed(0)}%` : 'Trung tâm'}</strong></label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={stereoPan}
              disabled={is8DEnabled}
              onChange={(e) => setStereoPan(Number(e.target.value))}
            />
            <div className="range-marks">
              <span>◄ TAI TRÁI</span>
              <span>TRUNG TÂM</span>
              <span>TAI PHẢI ►</span>
            </div>
          </div>
        </div>

       {/* CARD 5: SPEED / PITCH */}
        <div className="dsp-card glass-card">
          <div className="dsp-card-header">
            <h3>⚡ Tốc Độ Nhạc (Speed)</h3>
            <span className="dsp-value-badge">{playbackRate}x</span>
          </div>

          <div className="dsp-control-group">
            <label>Tốc độ phát: <strong>{playbackRate}x</strong> (0.25x ➔ 2.0x)</label>
            <input
              type="range"
              min="0.25"
              max="2.0"
              step="0.05"
              value={playbackRate}
              onChange={(e) => changeSpeed(Number(e.target.value))}
            />
          </div>

          <div className="preset-btn-group" style={{ marginTop: '8px' }}>
            {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                className={`preset-chip ${playbackRate === rate ? 'active' : ''}`}
                onClick={() => changeSpeed(rate)}
              >
                {rate === 1.0 ? '1.0x (Gốc)' : `${rate}x`}
              </button>
            ))}
          </div>
        </div>

        {/* CARD 6: 3D SPATIAL VR */}
        <div className={`dsp-card glass-card ${is3DSpacial ? 'active-dsp' : ''}`}>
          <div className="dsp-card-header">
            <h3>🌌 Âm Thanh Thực Tế Ảo (3D VR)</h3>
            <button
              className={`dsp-toggle-btn glow-hover-btn ${is3DSpacial ? 'active' : ''}`}
              onClick={() => setIs3DSpacial(!is3DSpacial)}
            >
              {is3DSpacial ? '🟢 BẬT' : '⚪ TẮT'}
            </button>
          </div>

          <div className="dsp-control-group">
            <label>Mô phỏng không gian phòng thu: <strong>{spatialReverb}%</strong></label>
            <input
              type="range"
              min="0"
              max="100"
              value={spatialReverb}
              disabled={!is3DSpacial}
              onChange={(e) => setSpatialReverb(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
