export const options = {
  chart: {
    height: 250,
    type: "line",
    zoom: {
      enabled: false,
    },
    background: "transparent",
    foreColor: "var(--bs-body-color)",
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    curve: "straight",
    colors: ["#0d6efd"],
    width: 1.5,
  },
  title: {
    text: "Reserve History",
    align: "left",
    style: {
      color: "var(--bs-body-color)",
    },
  },
  grid: {
    show: true,
    borderColor: "var(--bs-border-color)",
    strokeDashArray: 3,
    row: {
      opacity: 0.5,
    },
  },
  xaxis: {
    labels: {
      style: {
        colors: "var(--bs-body-color)",
      },
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: "var(--bs-body-color)",
      },
    },
    title: {
      text: "Exchange Rate",
      style: {
        color: "var(--bs-body-color)",
      },
    },
  },
  tooltip: {
    theme: "dark",
  },
}
