import { useMemo } from 'react';
import { ApexChart } from './ApexChart';

type RiskFactor = {
  name: string;
  value: number;
};

type TrendPoint = {
  month: string;
  avgRiskScore?: number;
};

interface HumanRiskAnalyticsProps {
  riskScore: number;
  riskFactors: RiskFactor[];
  trend: TrendPoint[];
  industryAverage?: number;
}

export function HumanRiskAnalytics({
  riskScore,
  riskFactors,
  trend,
  industryAverage,
}: HumanRiskAnalyticsProps) {
  // Radar chart data
  const radarSeries = [
    {
      name: 'Human Risk',
      data: riskFactors.map((factor) => factor.value),
    },
  ];

  const radarCategories = riskFactors.map((factor) => factor.name);

  // Prepare timeline and calculate a simple linear forecast.
  const timeline = useMemo(() => {
    const valid = trend.filter(
      (point) =>
        typeof point.avgRiskScore === 'number' &&
        Number.isFinite(point.avgRiskScore),
    );

    if (!valid.length) return null;

    const historical = valid.map((point) => point.avgRiskScore!);
    const count = historical.length;

    // Linear projection based on the latest observations.
    const recent = historical.slice(-4);
    const slope =
      recent.length > 1
        ? (recent[recent.length - 1] - recent[0]) /
          (recent.length - 1)
        : 0;

    const forecastCount = 4;
    const forecast = Array.from(
      { length: forecastCount },
      (_, index) =>
        Math.max(
          0,
          Math.min(
            100,
            historical[count - 1] + slope * (index + 1),
          ),
        ),
    );

    const categories = [
      ...valid.map((point) => point.month),
      ...Array.from(
        { length: forecastCount },
        (_, index) => `Forecast ${index + 1}`,
      ),
    ];

    const historicalData = [
      ...historical,
      ...Array(forecastCount).fill(null),
    ];

    const forecastData = [
      ...Array(count - 1).fill(null),
      historical[count - 1],
      ...forecast,
    ];

    const benchmarkData =
      industryAverage !== undefined
        ? Array(categories.length).fill(industryAverage)
        : [];

    return {
      categories,
      historicalData,
      forecastData,
      benchmarkData,
    };
  }, [trend, industryAverage]);

  const riskLevel =
    riskScore >= 75
      ? 'Critical'
      : riskScore >= 50
        ? 'High'
        : riskScore >= 25
          ? 'Medium'
          : 'Low';

  const riskColor =
    riskScore >= 75
      ? 'var(--ax-danger-500)'
      : riskScore >= 50
        ? 'var(--ax-warning-500)'
        : 'var(--ax-viz-emerald)';

  return (
    <div className="human-risk-analytics bg-transparent border-0">

      {/* GRAPH 1 — HUMAN RISK ASSESSMENT */}

      <section className="ax-card human-risk-card bg-transparent border-0">

        <div className="ax-card__header">
          <div className="ax-card__titles">
            <span className="ax-card__eyebrow">
              Risk Intelligence
            </span>

            <h2 className="ax-card__title">
              Human Risk Assessment
            </h2>

            <p className="ax-card__subtitle">
              Distribution of human-related security risk factors.
            </p>
          </div>

          <div
            className="human-risk-score"
            style={{ '--risk-color': riskColor } as React.CSSProperties}
          >
            <span>{riskLevel} Risk</span>
            <strong>{riskScore}%</strong>
          </div>
        </div>

        <div className="human-risk-chart">
          <ApexChart
            type="radar"
            height={330}
            ariaLabel="Radar chart showing human risk factors"
            series={radarSeries}
            apex={{
              chart: {
                background: 'transparent',
                toolbar: { show: false },
                animations: {
                  enabled: true,
                  easing: 'easeinout',
                  speed: 1600,
                  animateGradually: {
                    enabled: true,
                    delay: 200,
                  },
                  dynamicAnimation: {
                    enabled: true,
                    speed: 800,
                  },
                },
              },

              colors: [
                'var(--ax-chart-1)',
              ],

              stroke: {
                width: 2.5,
                curve: 'smooth',
              },

              fill: {
                opacity: 0.24,
              },

              markers: {
                size: 5,
                strokeWidth: 2,
                strokeColors: 'var(--ax-surface)',
                hover: {
                  size: 8,
                },
              },

              xaxis: {
                categories: radarCategories,
                labels: {
                  show: true,
                  style: {
                    colors: Array(radarCategories.length).fill(
                      'var(--ax-text-muted)',
                    ),
                    fontSize: '12px',
                    fontWeight: 500,
                  },
                },
              },

              yaxis: {
                min: 0,
                max: 100,
                tickAmount: 4,
                labels: {
                  style: {
                    colors: ['var(--ax-text-subtle)'],
                  },
                  formatter: (value: number) =>
                    `${Math.round(value)}`,
                },
              },

              plotOptions: {
                radar: {
                  polygons: {
                    strokeColors: 'var(--ax-border)',
                    connectorColors: 'var(--ax-border)',
                    fill: {
                      colors: [
                        'var(--ax-surface-subtle)',
                        'transparent',
                      ],
                    },
                  },
                },
              },

              tooltip: {
                theme: 'dark',
                y: {
                  formatter: (value: number) => `${value}%`,
                },
              },

              legend: {
                show: false,
              },
            }}
          />
        </div>

        <div className="human-risk-indicators">
          {riskFactors.map((factor, index) => (
            <div
              className="human-risk-indicator"
              key={factor.name}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <span className="human-risk-indicator__dot" />

              <span className="human-risk-indicator__name">
                {factor.name}
              </span>

              <strong>{factor.value}%</strong>
            </div>
          ))}
        </div>

      </section>


      {/* GRAPH 2 — RISK TIMELINE & FORECAST */}

      <section className="ax-card human-risk-card">

        <div className="ax-card__header">
          <div className="ax-card__titles">
            <span className="ax-card__eyebrow">
              Predictive Analytics
            </span>

            <h2 className="ax-card__title">
              Human Risk Timeline & Forecast
            </h2>

            <p className="ax-card__subtitle">
              Historical risk performance and projected trends.
            </p>
          </div>

          <div className="human-risk-live">
            <span className="human-risk-live__dot" />
            Live Analytics
          </div>
        </div>

        <div className="human-risk-chart human-risk-chart--timeline">

          {timeline ? (
            <ApexChart
              type="area"
              height={330}
              ariaLabel="Human risk timeline and projected risk forecast"
              series={[
                {
                  name: 'Historical Risk',
                  data: timeline.historicalData,
                },
                {
                  name: 'Projected Risk',
                  data: timeline.forecastData,
                },
                ...(industryAverage !== undefined
                  ? [
                      {
                        name: 'Industry Average',
                        data: timeline.benchmarkData,
                      },
                    ]
                  : []),
              ]}
              legend="bottom"
              apex={{
                chart: {
                  background: 'transparent',
                  toolbar: {
                    show: true,
                    tools: {
                      download: true,
                      selection: true,
                      zoom: true,
                      zoomin: true,
                      zoomout: true,
                      pan: true,
                      reset: true,
                    },
                  },
                  animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 1800,
                    animateGradually: {
                      enabled: true,
                      delay: 150,
                    },
                    dynamicAnimation: {
                      enabled: true,
                      speed: 900,
                    },
                  },
                },

                colors: [
                  'var(--ax-chart-1)',
                  'var(--ax-chart-2)',
                  'var(--ax-viz-emerald)',
                ],

                stroke: {
                  curve: 'smooth',
                  width: [3, 2.5, 2],
                  dashArray: [0, 7, 5],
                  lineCap: 'round',
                },

                fill: {
                  type: 'gradient',
                  gradient: {
                    shadeIntensity: 0.5,
                    opacityFrom: 0.34,
                    opacityTo: 0.025,
                    stops: [0, 90, 100],
                  },
                },

                markers: {
                  size: [4, 5, 0],
                  strokeWidth: 2,
                  hover: {
                    size: 8,
                  },
                },

                dataLabels: {
                  enabled: false,
                },

                xaxis: {
                  categories: timeline.categories,
                  labels: {
                    rotate: -35,
                    style: {
                      colors: 'var(--ax-text-muted)',
                      fontSize: '11px',
                    },
                  },
                  axisBorder: {
                    color: 'var(--ax-border)',
                  },
                  axisTicks: {
                    color: 'var(--ax-border)',
                  },
                },

                yaxis: {
                  min: 0,
                  max: 100,
                  tickAmount: 5,
                  labels: {
                    style: {
                      colors: 'var(--ax-text-muted)',
                    },
                    formatter: (value: number) =>
                      `${Math.round(value)}%`,
                  },
                },

                grid: {
                  borderColor: 'var(--ax-border)',
                  strokeDashArray: 5,
                  padding: {
                    left: 8,
                    right: 12,
                  },
                },

                tooltip: {
                  shared: true,
                  intersect: false,
                  theme: 'dark',
                  y: {
                    formatter: (value: number | null) =>
                      value == null ? '—' : `${value.toFixed(1)}%`,
                  },
                },

                legend: {
                  position: 'bottom',
                  horizontalAlign: 'center',
                  fontSize: '12px',
                  labels: {
                    colors: 'var(--ax-text-muted)',
                  },
                  markers: {
                    size: 5,
                  },
                },
              }}
            />
          ) : (
            <div className="human-risk-empty">
              No risk trend data available yet.
            </div>
          )}

        </div>

      </section>

    </div>
  );
}