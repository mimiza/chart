'use client'

import React, { useState, useEffect, useCallback } from "react";
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import {
  ema,
  discontinuousTimeScaleProviderBuilder,
  Chart,
  ChartCanvas,
  CurrentCoordinate,
  BarSeries,
  CandlestickSeries,
  LineSeries,
  MovingAverageTooltip,
  OHLCTooltip,
  lastVisibleItemBasedZoomAnchor,
  XAxis,
  YAxis,
  CrossHairCursor,
  EdgeIndicator,
  MouseCoordinateX,
  MouseCoordinateY,
  ZoomButtons,
} from "react-financial-charts";

const exchangeInfoUrl = "https://data-api.binance.vision/api/v3/exchangeInfo";
const klineUrl = "https://data-api.binance.vision/api/v3/klines";

const intervals = [
  { value: "1m", label: "1 minute" },
  { value: "3m", label: "3 minutes" },
  { value: "5m", label: "5 minutes" },
  { value: "15m", label: "15 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "2h", label: "2 hours" },
  { value: "4h", label: "4 hours" },
  { value: "6h", label: "6 hours" },
  { value: "8h", label: "8 hours" },
  { value: "12h", label: "12 hours" },
  { value: "1d", label: "1 day" },
  { value: "3d", label: "3 days" },
  { value: "1w", label: "1 week" },
  { value: "1M", label: "1 month" },
];

export default function App() {
  const [initialData, setData] = useState([]);
  const [error, setError] = useState(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("1h");
  const [symbols, setSymbols] = useState([]);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600
  });
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const yExtents = useCallback((data) => {
    if (!data.high || !data.low) return [0, 1]; // Default range if data is invalid
    const high = Math.max(data.high, data.ema89 || 0, data.ema200 || 0);
    const low = Math.min(data.low, data.ema89 || Infinity, data.ema200 || Infinity);
    const padding = (high - low) * 0.1; // 10% padding
    return [low - padding, high + padding];
  }, []);

  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const response = await fetch(exchangeInfoUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const symbolList = data.symbols
          .filter(s => s.status === 'TRADING')
          .map(s => s.symbol)
          .sort();
        setSymbols(symbolList);
      } catch (error) {
        console.error('Error fetching symbols:', error);
        setError('Error fetching symbols from Binance API');
      }
    };

    fetchSymbols();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSymbol = urlParams.get('symbol');
    const urlInterval = urlParams.get('interval');

    if (urlSymbol && symbols.includes(urlSymbol)) {
      setSymbol(urlSymbol);
    }

    if (urlInterval && intervals.some(i => i.value === urlInterval)) {
      setInterval(urlInterval);
    }
  }, [symbols]);

  useEffect(() => {
    const fetchBinanceData = async () => {
      if (symbol && interval) {
        try {
          const response = await fetch(`${klineUrl}?symbol=${symbol}&interval=${interval}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          const processedData = processBinanceData(data);
          setData(processedData);
          setError(null);
        } catch (error) {
          console.error('Error fetching data:', error);
          setError('Error fetching data from Binance API');
        }
      }
    };

    fetchBinanceData();

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [symbol, interval]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  const handleSymbolChange = (event) => {
    const newSymbol = event.target.value;
    setSymbol(newSymbol);
    updateUrlParams(newSymbol, interval);
  };

  const handleIntervalChange = (event) => {
    const newInterval = event.target.value;
    setInterval(newInterval);
    updateUrlParams(symbol, newInterval);
  };

  const updateUrlParams = (newSymbol, newInterval) => {
    const url = new URL(window.location);
    url.searchParams.set('symbol', newSymbol);
    url.searchParams.set('interval', newInterval);
    window.history.pushState({}, '', url);
  };

  if (error) {
    return <div style={{ color: '#d1d4dc' }}>Error: {error}</div>;
  }

  if (!initialData || initialData.length === 0) {
    return <div style={{ color: '#d1d4dc' }}>Loading data...</div>;
  }

  const ScaleProvider = discontinuousTimeScaleProviderBuilder().inputDateAccessor(
    (d) => d.date
  );
  const { data, xScale, xAccessor, displayXAccessor } = ScaleProvider(initialData);

  const margin = { left: 0, right: 48, top: 30, bottom: 24 };
  const height = dimensions.height - 100;
  const width = dimensions.width;

  const ema89 = ema()
    .id(1)
    .options({ windowSize: 89 })
    .merge((d, c) => {
      d.ema89 = c;
    })
    .accessor((d) => d.ema89);

  const ema200 = ema()
    .id(2)
    .options({ windowSize: 200 })
    .merge((d, c) => {
      d.ema200 = c;
    })
    .accessor((d) => d.ema200);

  const calculatedData = ema200(ema89(data));
  const pricesDisplayFormat = format(".2f");

  const xExtents = [xAccessor(calculatedData[calculatedData.length - 1]), xAccessor(calculatedData[0])];

  const gridHeight = height - margin.top - margin.bottom;
  const barChartHeight = gridHeight / 4;
  const barChartOrigin = (_, h) => [0, h - barChartHeight];
  const chartHeight = gridHeight;

  const dateTimeFormat = "%Y-%m-%d %H:%M:%S";
  const timeDisplayFormat = timeFormat(dateTimeFormat);

  return (
    <div style={{ backgroundColor: "#131722", height: "100vh", fontFamily: "'Trebuchet MS', sans-serif" }}>
      <div style={{ padding: "20px", backgroundColor: "#1e222d", color: "#d1d4dc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <label style={{ marginRight: "10px" }}>Symbol: </label>
          <select 
            value={symbol} 
            onChange={handleSymbolChange} 
            style={{ 
              marginRight: "20px", 
              backgroundColor: "#2a2e39", 
              color: "#d1d4dc", 
              border: "1px solid #4a4a4a", 
              padding: "5px" 
            }}
          >
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <label style={{ marginRight: "10px" }}>Interval: </label>
          <select 
            value={interval} 
            onChange={handleIntervalChange} 
            style={{ 
              backgroundColor: "#2a2e39", 
              color: "#d1d4dc", 
              border: "1px solid #4a4a4a", 
              padding: "5px" 
            }}
          >
            {intervals.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: "24px", fontWeight: "bold" }}>
          {currentDateTime.toLocaleString()}
        </div>
      </div>

      <ChartCanvas
        height={height}
        ratio={3}
        width={width}
        margin={margin}
        data={calculatedData}
        displayXAccessor={displayXAccessor}
        seriesName="Data"
        xScale={xScale}
        xAccessor={xAccessor}
        xExtents={xExtents}
        zoomAnchor={lastVisibleItemBasedZoomAnchor}
        disableInteraction={false}
        mouseMoveEvent={true}
        panEvent={true}
        zoomEvent={true}
        clamp={false}
      >
        <Chart id={2} height={barChartHeight} origin={barChartOrigin} yExtents={(d) => d.volume}>
          <BarSeries fillStyle={(d) => d.close > d.open ? "rgba(76, 175, 80, 0.3)" : "rgba(255, 82, 82, 0.3)"} yAccessor={(d) => d.volume} />
        </Chart>
        <Chart id={3} height={chartHeight} yExtents={yExtents}>
          <XAxis showGridLines gridLinesStrokeStyle="#2a2e39" tickLabelFill="#d1d4dc" />
          <YAxis showGridLines gridLinesStrokeStyle="#2a2e39" tickLabelFill="#d1d4dc" tickFormat={pricesDisplayFormat} />
          <CandlestickSeries
            wickStroke={(d) => d.close > d.open ? "#4CAF50" : "#FF5252"}
            fill={(d) => d.close > d.open ? "#4CAF50" : "#FF5252"}
            stroke={(d) => d.close > d.open ? "#4CAF50" : "#FF5252"}
          />
          <LineSeries yAccessor={ema89.accessor()} strokeStyle="#2962FF" />
          <CurrentCoordinate yAccessor={ema89.accessor()} fillStyle="#2962FF" />
          <LineSeries yAccessor={ema200.accessor()} strokeStyle="#FF6D00" />
          <CurrentCoordinate yAccessor={ema200.accessor()} fillStyle="#FF6D00" />
          <MouseCoordinateY rectWidth={margin.right} displayFormat={pricesDisplayFormat} />
          <EdgeIndicator
            itemType="last"
            rectWidth={margin.right}
            fill={(d) => d.close > d.open ? "#4CAF50" : "#FF5252"}
            lineStroke={(d) => d.close > d.open ? "#4CAF50" : "#FF5252"}
            displayFormat={pricesDisplayFormat}
            yAccessor={(d) => d.close}
          />
          <MovingAverageTooltip
            origin={[8, 24]}
            options={[
              {
                yAccessor: ema89.accessor(),
                type: "EMA",
                stroke: "#2962FF",
                windowSize: ema89.options().windowSize
              },
              {
                yAccessor: ema200.accessor(),
                type: "EMA",
                stroke: "#FF6D00",
                windowSize: ema200.options().windowSize
              }
            ]}
            textFill="#ffffff"
          />
          <ZoomButtons />
          <OHLCTooltip origin={[8, 16]} textFill="#ffffff" />
          <MouseCoordinateX displayFormat={timeDisplayFormat} />
        </Chart>
        <CrossHairCursor />
      </ChartCanvas>
    </div>
  );
}