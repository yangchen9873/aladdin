/**
 * @fileoverview 查询城市当前天气（Open-Meteo，无需 API Key）。
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

/** 前端和审计记录使用的天气详情。 */
export type WeatherDetails = {
  location: string;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  temperatureC: number;
  apparentTemperatureC: number;
  humidity: number;
  windKmh: number;
  weatherCode: number;
  weather: string;
  observedAt: string;
};

type GeocodeResult = {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type GeocodeResponse = { results?: GeocodeResult[] };

type ForecastResponse = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
};

const WEATHER_LABELS: Record<number, string> = {
  0: "晴",
  1: "大部晴朗",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "强阵雨",
  82: "暴阵雨",
  95: "雷暴",
  96: "雷暴伴冰雹",
  99: "强雷暴伴冰雹",
};

/**
 * 请求 JSON 接口，非 2xx 响应直接抛错。
 * @param url - 请求地址
 * @param signal - 取消信号
 * @returns 服务端 JSON 数据
 * @throws {Error} HTTP 状态码非 2xx 时抛出异常
 */
async function fetchJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`天气服务请求失败（HTTP ${response.status}）`);
  return (await response.json()) as T;
}

/**
 * 将 WMO 天气代码转换为中文描述。
 * @param code - WMO 天气代码
 * @returns 中文天气描述，未知代码返回代码文本
 */
function weatherLabel(code: number): string {
  return WEATHER_LABELS[code] ?? `天气代码 ${code}`;
}

const weatherSchema = Type.Object({
  location: Type.String({ description: "城市名称，例如：北京、上海、深圳" }),
});

/** 查询城市当前天气。 */
export const getWeatherTool: AgentTool<typeof weatherSchema, WeatherDetails> = {
  name: "getWeather",
  label: "查询天气",
  description: "查询城市当前天气，支持中国城市，无需 API Key。",
  parameters: weatherSchema,
  execute: async (_toolCallId, params, signal) => {
    const location = params.location.trim();

    if (!location) throw new Error("location is empty");

    // 先用地理编码将城市名转换为经纬度，再查询当前天气。
    const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodeUrl.searchParams.set("name", location);
    geocodeUrl.searchParams.set("count", "1");
    geocodeUrl.searchParams.set("language", "zh");
    geocodeUrl.searchParams.set("format", "json");

    const geocode = await fetchJson<GeocodeResponse>(geocodeUrl, signal);
    const place = geocode.results?.[0];

    if (!place) throw new Error(`未找到地点：${location}`);

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(place.latitude));
    forecastUrl.searchParams.set("longitude", String(place.longitude));
    forecastUrl.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    );
    forecastUrl.searchParams.set("timezone", "auto");

    const forecast = await fetchJson<ForecastResponse>(forecastUrl, signal);
    const current = forecast.current;

    if (
      current?.temperature_2m === undefined ||
      current.apparent_temperature === undefined ||
      current.relative_humidity_2m === undefined ||
      current.weather_code === undefined ||
      current.wind_speed_10m === undefined
    ) {
      throw new Error("天气服务未返回完整实况数据");
    }

    const details: WeatherDetails = {
      location: place.name,
      country: place.country ?? null,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: forecast.timezone ?? place.timezone ?? "UTC",
      temperatureC: current.temperature_2m,
      apparentTemperatureC: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windKmh: current.wind_speed_10m,
      weatherCode: current.weather_code,
      weather: weatherLabel(current.weather_code),
      observedAt: current.time ?? new Date().toISOString(),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
      details,
    };
  },
};
