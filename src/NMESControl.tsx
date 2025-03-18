import React, { useState, useEffect, useRef } from "react";
import { useBluetooth } from "./BluetoothContext";
import BluetoothControl from "./BluetoothControl";
import styles from "./NMESControlPanel.module.css";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

const NMESControlPanel: React.FC = () => {
  const { 
    isConnected, 
    runOptimizationLoop, 
    imuData, 
    startIMU, 
    stopIMU, 
    stopStimulation, 
    stopOptimizationLoop, 
   isOptimizationRunning 
  } = useBluetooth();

  const [sensor1Data, setSensor1Data] = useState<{ time: number; sensorValue: number }[]>([]);
  const [sensor2Data, setSensor2Data] = useState<{ time: number; sensorValue: number }[]>([]);

  const [isMeasuring, setIsMeasuring] = useState(false);

  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [currentPair, setCurrentPair] = useState<[number, number] | null>(null);
  const [bestPair, setBestPair] = useState<[number, number] | null>(null);

  const [currentBeingTested, setCurrentBeingTested] = useState<number | null>(null);
  const [bestCurrent, setBestCurrent] = useState<number | null>(null);

  const [minCurrent, setMinCurrent] = useState(1.0);
  const [maxCurrent, setMaxCurrent] = useState(15.0);

  const [sampleCount, setSampleCount] = useState(0);



  // Update sensor values only when IMU measurement is active
  useEffect(() => {
    if (isConnected && isMeasuring) {
        const interval = setInterval(() => {
            setSampleCount((prev) => prev + 1);

            setSensor1Data((prevData) => [
                ...prevData.slice(-49), 
                { time: sampleCount, sensorValue: imuData.imu1_changes.length > 0 ? imuData.imu1_changes[imuData.imu1_changes.length - 1] : 0 }
            ]);

            setSensor2Data((prevData) => [
                ...prevData.slice(-49), 
                { time: sampleCount, sensorValue: imuData.imu2_changes.length > 0 ? imuData.imu2_changes[imuData.imu2_changes.length - 1] : 0 }
            ]);

          }, 100);

        return () => clearInterval(interval);
    }
  }, [isConnected, isMeasuring, imuData, sampleCount]); 


  // Timer for elapsed time during optimization
  useEffect(() => {
    if (isOptimizationRunning) {
        startTimeRef.current = performance.now(); // ✅ Store start time
        const updateElapsedTime = () => {
            if (!isOptimizationRunning) return;
            const now = performance.now();
            setElapsedTime(now - (startTimeRef.current ?? now)); // ✅ Calculate precise time
            animationFrameRef.current = requestAnimationFrame(updateElapsedTime);
        };
        animationFrameRef.current = requestAnimationFrame(updateElapsedTime);
    } else {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setElapsedTime(0); // ✅ Reset when stopping
    }

    return () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };
  }, [isOptimizationRunning]);

  const handleStartOptimization = async () => {
      console.log("🟢 Starting optimization...");
      if (!isMeasuring) {
        handleStartIMU(); 
        await new Promise(res => setTimeout(res, 1000)); // Ensure IMU starts before sending commands
      }
      setElapsedTime(0);
      setBestPair(null);
      setCurrentPair(null);
      setBestCurrent(null);
      setCurrentBeingTested(null);

      await runOptimizationLoop(
        (pair) => setCurrentPair(pair),
        (pair) => {setBestPair(pair); handleStopIMU();},
        (current) => setCurrentBeingTested(current),
        (current) => setBestCurrent(current),
        minCurrent,
        maxCurrent
      );
    };
  
  const handleStopOptimization = async () => {
      console.log("🛑 Stopping optimization...");
      await stopOptimizationLoop(); 
      handleStopIMU();
  };

  const handleStartIMU = () => {
    setIsMeasuring(true);
    setSampleCount(0);
    startIMU();
    setSensor1Data([]);
    setSensor2Data([]);
  };

  const handleStopIMU = () => {
    setIsMeasuring(false);
    stopIMU();
    setSensor1Data([]);
    setSensor2Data([]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img src="/mms_logo_2.png" alt="App Logo" className={styles.logo} />
        <h1 className={styles.heading}>MMS - NMES Optimization</h1>
      </div>

      <div className={styles.topContainer}>
        <div className={styles.buttonContainer}>
          <BluetoothControl />
        </div>

        {isConnected && (
          <div className={styles.controlBox}>
              <h2>Search Algorithm & Sensor Control</h2>

              <div className={styles.inputGroup}>
                <div className={styles.inputContainer}>
                  <label>Min Current (mA): </label>
                  <input
                    type="number"
                    value={minCurrent}
                    onChange={(e) => setMinCurrent(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>

                <div className={styles.inputContainer}>
                  <label>Max Current (mA): </label>
                  <input
                    type="number"
                    value={maxCurrent}
                    onChange={(e) => setMaxCurrent(parseFloat(e.target.value))}
                    step="0.1"
                  />
                </div>
              </div>

              <div className={styles.buttonContainer} style={{ marginTop: "15px" }}>
              <button 
                      className={styles.button} 
                      onClick={handleStartOptimization} 
                      disabled={isOptimizationRunning} 
              >
                      Start Optimization
                  </button>

                  <button 
                      className={styles.button} 
                      onClick={handleStopOptimization} 
                      disabled={!isOptimizationRunning} 
                  >
                      Stop Optimization
                  </button>
              </div>

              <p>Elapsed Time: {(elapsedTime / 1000).toFixed(3)} seconds</p> 

              <div className={styles.buttonContainer}>
                <button className={styles.button} onClick={handleStartIMU} disabled={!isConnected || isMeasuring}>
                  Start Sensor(s)
                </button>
                <button className={styles.button} onClick={handleStopIMU} disabled={!isConnected || !isMeasuring}>
                  Stop Sensor(s)
                </button>
              </div>
          </div> 
      )} 

      </div> {/* ✅ Close topContainer here before moving to next section */}

      {isConnected && (
        <div className={styles.contentContainer}>
          <div className={styles.leftPanel}>
            <div className={styles.electrodeBox}>
              <h2>Electrode Pair & Current</h2>
              <p>Pair and current being tested.</p>
              <div>
                <span>Current Pair: </span>
                <span className={`${styles.valueBox}`}>
                  {currentPair ? `(${currentPair[0]}, ${currentPair[1]})` : "Waiting..."}
                </span>
              </div>
              <div>
                <span>Current (mA): </span>
                <span className={`${styles.valueBox}`}>
                  {currentBeingTested !== null ? `${currentBeingTested} mA` : "Waiting..."}
                </span>
              </div>
              <div>
                <span>Best Pair: </span>
                <span className={`${styles.valueBox} ${styles.green}`}>
                  {bestPair ? `(${bestPair[0]}, ${bestPair[1]})` : "Searching..."}
                </span>
              </div>
              <div>
                <span>Best Current (mA): </span>
                <span className={`${styles.valueBox} ${styles.green}`}>
                  {bestCurrent !== null ? `${bestCurrent} mA` : "Searching..."}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.rightPanel}>
            <div className={styles.chartContainer}>
              <h3>Sensor 1 Readings</h3>
              <LineChart width={600} height={200} data={sensor1Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} />
                <YAxis domain={[0, "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sensorValue" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </div>

            <div className={styles.chartContainer}>
              <h3>Sensor 2 Readings</h3>
              <LineChart width={600} height={200} data={sensor2Data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} />
                <YAxis domain={[0, "auto"]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sensorValue" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NMESControlPanel;





