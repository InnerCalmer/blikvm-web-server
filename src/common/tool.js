
/*****************************************************************************
#                                                                            #
#    blikvm                                                                  #
#                                                                            #
#    Copyright (C) 2021-present     blicube <info@blicube.com>               #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
*****************************************************************************/
/**
 * This module provides utility functions.
 * @module common/tool
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { v4 } from 'uuid';
import { HardwareType, StreamerType } from './enums.js';
import { execSync, exec } from 'child_process';
import si from 'systeminformation';
import Logger from '../log/logger.js';
import { createApiObj } from './api.js';

const logger = new Logger();

let hardwareSysType = HardwareType.UNKNOWN;

let streamerSysType = StreamerType.UNKNOWN;

/**
 * Checks if a directory exists at the specified path.
 *
 * @param {string} path - The path to the directory.
 * @returns {boolean} - Returns true if the directory exists, false otherwise.
 */
function dirExists(path) {
  return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
}

/**
 * Checks if a file exists at the specified path.
 *
 * @param {string} path - The path to the file.
 * @returns {boolean} - Returns true if the file exists and is a regular file, otherwise returns false.
 */
function fileExists(path) {
  return fs.existsSync(path) && fs.lstatSync(path).isFile();
}

function isDeviceFile(path) {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Creates a directory recursively if it doesn't exist.
 * @param {string} dirname - The directory path to create.
 * @returns {boolean} Returns true if the directory is created successfully, false otherwise.
 */
function createDir(dirname) {
  if (dirExists(dirname)) {
    return true;
  }

  const parentDir = path.dirname(dirname);
  if (parentDir !== dirname) {
    if (createDir(parentDir)) {
      fs.mkdirSync(dirname);
      return true;
    }
  }

  return false;
}

/**
 * Creates a file at the specified file path.
 * @param {string} filePath - The path of the file to be created.
 * @param {boolean} [append=false] - Optional. Specifies whether to append to an existing file. Default is false.
 */
function createFile(filePath, append = false) {
  const dirname = path.dirname(filePath);
  createDir(dirname);
  if (append) {
    fs.appendFileSync(filePath, '');
  } else {
    fs.writeFileSync(filePath, '');
  }
}

/**
 * Generates a unique code.
 * @returns {string} The generated unique code.
 */
function generateUniqueCode() {
  return v4();
}

/**
 * Generates a random secret password of the specified length.
 *
 * @param {number} length - The length of the password to generate.
 * @returns {string} The generated password.
 */
function generateSecret(length) {
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const allChars = uppercaseChars + lowercaseChars + numberChars;

  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * allChars.length);
    password += allChars[randomIndex];
  }

  return password;
}

function getSreamerType() {
  return streamerSysType;
}

/**
 * Retrieves the hardware type based on the device model.
 * @returns {enmus} The hardware type, see HardwareType.
 */
function getHardwareType() {
  if (hardwareSysType === HardwareType.UNKNOWN) {
    const modelOutput = execSync('cat /proc/device-tree/model').toString();
    const pi4bSys = 'Raspberry Pi 4 Model B';
    const mangoPiSys = 'MangoPi Mcore';
    const piCM4Sys = 'Raspberry Pi Compute Module 4';
    const orangePiCM4Sys="Rockchip RK3566 Orange Pi CM4 Board"

    if (modelOutput.includes(pi4bSys)) {
      hardwareSysType = HardwareType.PI4B;
      streamerSysType = StreamerType.Ustreamer;
    } else if (modelOutput.includes(mangoPiSys)) {
      hardwareSysType = HardwareType.MangoPi;
      streamerSysType = StreamerType.Ustreamer;
    } else if (modelOutput.includes(piCM4Sys)) {
      hardwareSysType = HardwareType.CM4;
      streamerSysType = StreamerType.Ustreamer;
    } else if (modelOutput.includes(orangePiCM4Sys)) {
      hardwareSysType = HardwareType.OrangePiCM4;
      streamerSysType = StreamerType.Gstreamer;
    }
  }
  return hardwareSysType;
}

function executeScriptAtPath(scriptPath, args = []) {
  const bashCommand = `bash ${scriptPath} ${args.join(' ')}`;
  return new Promise((resolve, reject) => {
    exec(bashCommand, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(`Script execution failed: ${stderr}`);
        err.code = error.code;
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

function executeCMD(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function getSystemType() {
  try {
    const output = execSync('mount | grep " / "', { encoding: 'utf-8' });
    if (output.includes('ro,noatime')) {
      return 'ro';
    } else if (output.includes('rw,noatime')) {
      return 'rw';
    } else {
      return 'error';
    }
  } catch (error) {
    return 'error';
  }
}

function changetoRWSystem() {
  try {
    const output = execSync('mount | grep " / "', { encoding: 'utf-8' });
    if (output.includes('ro,noatime')) {
      execSync('mount -o remount,rw /');
    }
    return true;
  } catch (error) {
    return false;
  }
}

function changetoROSystem() {
  try {
    const output = execSync('mount | grep " / "', { encoding: 'utf-8' });
    if (output.includes('rw,noatime')) {
      execSync('mount -o remount,ro /');
    }
    return true;
  } catch (error) {
    return false;
  }
}

function getAllFilesInDirectory(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    let fileList = [];

    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        fileList.push(filePath);
      } else if (stats.isDirectory()) {
        const subFiles = getAllFilesInDirectory(filePath);
        fileList = fileList.concat(subFiles);
      }
    });
    return fileList;
  } catch (err) {
    return [];
  }
}

/**
 * 延迟指定的毫秒数。
 * @param {number} ms - 延迟的毫秒数。
 * @returns {Promise} Promise 对象，表示延迟完成。
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDiskSpace(path) {
  try {
    // 获取磁盘信息
    const disk = await si.fsSize();
    // 在磁盘信息中找到指定路径的磁盘
    const diskOnPath = disk.find((d) => d.mount === path);

    // console.log('diskOnPath', diskOnPath);

    // 如果找到了指定路径的磁盘信息
    if (diskOnPath) {
      const resJson = {
        used: diskOnPath.used,
        size: diskOnPath.size // 磁盘剩余空间
      };
      return resJson;
    } else {
      // 如果未找到指定路径的磁盘信息，则返回空对象或者null，视情况而定
      logger.error(`can't find ${path}`);
      return {}; // 或者 return null;
    }
  } catch (err) {
    // 捕获异常并返回null
    return null;
  }
}

async function readVentoyDirectory(ventoyDirectory) {
  try {
    // Use getDiskSpace to get disk space information
    const { used, size } = await getDiskSpace('/mnt');

    const files = await fsPromises.readdir(ventoyDirectory);

    const fileInformation = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(ventoyDirectory, file);
        try {
          const stats = await fsPromises.stat(filePath);

          // Check if the file is a regular file
          if (stats.isFile()) {
            return {
              name: file,
              path: filePath,
              imageSize: stats.size,
              date: stats.mtime
            };
          }
        } catch (error) {
          // Handle error for individual file stat
          console.error(`Error reading file stats for ${file}:`, error);
        }
      })
    );

    // Filter out undefined values (directories or non-regular files)
    const filteredFileInformation = fileInformation.filter((info) => info);
    const capacity = (((size - used) / size) * 100).toFixed(2);
    return {
      size,
      used,
      capacity,
      files: filteredFileInformation
    };
  } catch (error) {
    console.error('Error reading directory:', error);
  }
}

function processPing(ws, ping) {
  const ret = createApiObj();
  ret.data.pong = ping;
  ws.send(JSON.stringify(ret));
}

async function getSystemInfo() {
  try {
    const [load, uptime, temp] = await Promise.all([
      si.currentLoad(),
      si.time(),
      si.cpuTemperature()
    ]);

    const cpuLoad = load.currentLoad.toFixed(2);
    const temperature = temp.main.toFixed(2);
    const uptimeSeconds = uptime.uptime;
    const days = Math.floor(uptimeSeconds / (24 * 3600));
    const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const formattedUptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;


    const resJson = {
      cpuLoad: parseFloat(cpuLoad),
      uptime: formattedUptime,
      temperature: parseFloat(temperature)
    };
    return resJson;
  } catch (err) {
    logger.error(`getSystemInfo Error: ${err.message}`);
  }
}

function getCurrentTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export {
  dirExists,
  fileExists,
  createDir,
  createFile,
  generateUniqueCode,
  generateSecret,
  getHardwareType,
  getSreamerType,
  executeScriptAtPath,
  isDeviceFile,
  executeCMD,
  getSystemType,
  changetoRWSystem,
  changetoROSystem,
  getAllFilesInDirectory,
  sleep,
  readVentoyDirectory,
  processPing,
  getSystemInfo,
  getCurrentTimestamp
};
