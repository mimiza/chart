import React, { useState, useEffect } from 'react';
// import { ChartCanvas, Chart, CandlestickSeries, discontinuousTimeScaleProvider, CrossHairCursor, MouseCoordinateX, MouseCoordinateY } from "react-financial-charts";
import {
  elderRay,
  ema,
  discontinuousTimeScaleProviderBuilder,
  Chart,
  ChartCanvas,
  CurrentCoordinate,
  BarSeries,
  CandlestickSeries,
  ElderRaySeries,
  LineSeries,
  MovingAverageTooltip,
  OHLCTooltip,
  SingleValueTooltip,
  lastVisibleItemBasedZoomAnchor,
  XAxis,
  YAxis,
  CrossHairCursor,
  EdgeIndicator,
  MouseCoordinateX,
  MouseCoordinateY,
  ZoomButtons,
  withDeviceRatio,
  withSize
} from "react-financial-charts";
import './App.css';

const url = "https://data-api.binance.vision/api/v3/klines"

// Get params from browser location
const urlParams = new URLSearchParams(window.location.search);
const symbol = urlParams.get('symbol') || "BTCUSDT"
const interval = urlParams.get('interval') || "1h"

function App() {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);

  const fetchBinanceData = async () => {
    if (symbol && interval) {
      try {
        const response = await fetch(`${url}?symbol=${symbol}&interval=${interval}`).then((res) => res.json());
        const processedData = processBinanceData(response);
        setData(processedData);
      } catch (error) {
        setError('Error fetching data from Binance API');
      }
    }
  };

  const processBinanceData = (rawData) => {
    return rawData.map((d) => ({
      date: new Date(d[0]),
      open: parseFloat(d[1]),
      high: parseFloat(d[2]),
      low: parseFloat(d[3]),
      close: parseFloat(d[4]),
      volume: parseFloat(d[5]),
    }));
  };

  useEffect(() => {
    fetchBinanceData();
  });

  if (error) return <div>{error}</div>;

  if (!data || data.length === 0) {
    return <div>Loading...</div>;
  }

  const { data: chartData, xScale, xAccessor, displayXAccessor } = discontinuousTimeScaleProvider.inputDateAccessor(
    (d) => new Date(d.date)
  )(data);
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ChartCanvas
        height={500}
        ratio={1}
        width={window.innerWidth}
        margin={{ left: 50, right: 50, top: 10, bottom: 30 }}
        type="svg"
        seriesName="Binance"
        data={chartData}
        xScale={xScale}
        xAccessor={xAccessor}
        displayXAccessor={displayXAccessor}
      >
        <Chart id={1} yExtents={(d) => [d.high, d.low]}>
          <CandlestickSeries />
          <MouseCoordinateX />
          <MouseCoordinateY />
        </Chart>
        <CrossHairCursor />
      </ChartCanvas>
    </div>
  );
}

export default App