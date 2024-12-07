import termkit from 'terminal-kit';
import os from 'os';
import { exec } from 'child_process';

const term = termkit.terminal;

// Default to monitoring Node.js processes
let TARGET_PROCESS = 'node';
let maxCpuValueWas = 0;
let maxMemValueWas = 0;

const MAX_DATA_POINTS = 60; 
const CORES = os.cpus().length;

/**
 * @type {import('.').Stat['cpu'][]}
 */
const cpuData = [];

/**
 * @type {import('.').Stat['mem'][]}
 */
const memData = [];

/**
 * 
 * @param {(stat: import('.').Stat[]) => {}} callback 
 */
function getProcessStats(callback) {
  exec(`ps -eo pid,comm,%cpu,%mem,rss | grep ${TARGET_PROCESS}`, (err, stdout) => {
    if (err || !stdout) {
      callback(null);
      return;
    }

    const lines = stdout.trim().split('\n');
    const stats = lines.map((line) => {
      const [pid, command, cpu, mem, rss] = line.trim().split(/\s+/);
      return { 
        pid, 
        command, 
        cpu: parseFloat(cpu),
        mem: parseFloat(mem), 
        rss: parseInt(rss) / 1024, // Convert KB to MB
      };
    });
    callback(stats);
  });
}

/**
 * @template {number} T
 * @param {T[]} data 
 * @param {string} label 
 * @param {number} maxValue
 */
function renderAsciiLineChart(data, label, maxValue = 100) {
  const height = 10; // Number of rows in the chart
  const width = MAX_DATA_POINTS;  // Number of columns in the chart

  // Normalize data to fit the chart height (scaled to fit in the terminal window)
  const normalizedData = data.map(val => Math.round((val / maxValue) * height));  // Normalize to 10 rows

  /**
   * Initialize an empty 2D chart
   * @type {string[][]}
   */
  const chart = Array.from({ length: height }, () => Array(width).fill(' '));

  normalizedData.forEach((value, index) => {
    const y = height - value - 1;  // Invert the Y axis to fit the terminal (top-down)
    const x = index;

    if (x < width && y < height) {
      try {
        chart[y][x] = '█';  // Place the point at the calculated position
      } catch(e) {
        // console.error(e, chart, x, y, chart[y]);
      }
    }
  });

  const chartStr = chart.map(row => row.join('')).join('\n');

  // Display the chart with the label
  term.bold.underline(`\n${label}:\n`);
  term.green(chartStr);
}

/**
 * 
 * @param {import('.').Stat[]} stats 
 * @returns 
 */
function updateDashboard(stats) {
  term.clear();

  if (!stats || stats.length === 0) {
    term.red('No data for process: ').bold(`${TARGET_PROCESS}\n`);
    return;
  }

  term.bold.underline('Process Details\n');
  stats.forEach(({ pid, command, cpu, mem }) => {
    term(`PID: ${pid}, Command: ${command}, CPU: ${cpu.toFixed(2)}%, MEM: ${mem.toFixed(2)}%\n`);
  });

  const { cpu, mem, rss } = stats[0]; // Use the first process if multiple match
  cpuData.push(cpu);
  memData.push(mem);

  if (cpu > maxCpuValueWas) {
    maxCpuValueWas = cpu;
  }

  if (rss > maxMemValueWas) {
    maxMemValueWas = rss;
  }

  // Ensure the data buffers don't exceed the max number of points
  if (cpuData.length > MAX_DATA_POINTS) {
    cpuData.shift();
  }

  if (memData.length > MAX_DATA_POINTS) { 
    memData.shift();
  }

  renderAsciiLineChart(cpuData, `CPU Usage ${cpu}%; Max was: ${maxCpuValueWas}%`, CORES * 100);
  renderAsciiLineChart(memData, `Memory Usage ${mem}%; Max was: ${maxMemValueWas.toFixed(1)} MB`, 20);
}

function main() {
  setInterval(() => {
    getProcessStats(updateDashboard);
  }, 1000); 
}

// Start the application
term.clear();

term.magenta( "Entre PID or process name: " ) ;
term.inputField(( error , input ) => {
  TARGET_PROCESS = input;
  term.green('\nStarting process monitor for: ').bold(`${TARGET_PROCESS}\n`);
  main();
}) ;

term.on('key', (key) => {
  if (key === 'CTRL_C') {
    term.red('\nExiting...\n');
    process.exit();
  }
});