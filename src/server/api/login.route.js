
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
import { ApiCode, createApiObj } from '../../common/api.js';
import fs from 'fs';
import fsPromises from 'fs/promises';
import bcrypt from 'bcrypt';
import { CONFIG_PATH, JWT_SECRET } from '../../common/constants.js';
import Logger from '../../log/logger.js';
import jwt from 'jsonwebtoken';

const logger = new Logger();

const hashEncrypt = async (value) => {
  const saltRounds = 10;
  return await bcrypt.hash(value, saltRounds);
};

const verifiedHash = async (value, hashedValue) => {
  return await bcrypt.compare(value, hashedValue);
};

function getUsers() {
  const { userManager } = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const { Accounts } =  JSON.parse(fs.readFileSync(userManager.userFile, 'utf8'));
  return Accounts;
}

async function apiCreateAccount(req, res, next) {
  try {
    const returnObject = createApiObj();
    const { role, username, password } = req.body;
    if(role !== 'admin') {
      returnObject.msg = 'Only admin can create accounts!';
      returnObject.code = ApiCode.INVALID_CREDENTIALS;
      res.json(returnObject);
      return;
    }
    if (!username || !password) {
      returnObject.msg = 'Account name and password cannot be empty!';
      returnObject.code = ApiCode.INVALID_INPUT_PARAM;
      res.json(returnObject);
      return;
    }
    const users = getUsers();
    const userExists = users.some(user => user.username === username);
    if (userExists) {
      returnObject.msg = 'Username already exists!';
      returnObject.code = ApiCode.INVALID_INPUT_PARAM;
      res.json(returnObject);
      return;
    }
    const hashedPassword = await hashEncrypt(password, 10);
    const newUser = {
      username,
      password: hashedPassword,
      role: 'readonly',
      isEnabled: 'true'
    };
    const { userManager } = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const userFile =  JSON.parse(fs.readFileSync(userManager.userFile, 'utf8'));
    userFile.Accounts.push(newUser);

    fs.writeFileSync(userManager.userFile, JSON.stringify(userFile, null, 2), 'utf8');
    returnObject.msg = 'Account created successfully!';
    returnObject.code = ApiCode.OK;
    res.json(returnObject);
  }
  catch (err) {
    next(err);
  }
}

function apiGetUserList(req, res, next) {
  try {
    const returnObject = createApiObj();
    const users = getUsers();
    const usernames = users.map(user => user.username);
    returnObject.code = ApiCode.OK;
    returnObject.data = usernames;
    res.json(returnObject);
  } catch (err) {
    next(err);
  }
}

//TODO
function apiDeleteAccount(req, res, next) {
  try {
    const returnObject = createApiObj();
    const { role, username } = req.body;
    if(role !== 'admin') {
      returnObject.msg = 'Only admin can delete accounts!';
      returnObject.code = ApiCode.INVALID_CREDENTIALS;
      res.json(returnObject);
      return;
    }

    const { userManager } = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const userFile =  JSON.parse(fs.readFileSync(userManager.userFile, 'utf8'));

    const users = userFile.Accounts;
    const userIndex = users.findIndex(user => user.username === username);
    if (userIndex === -1) {
      returnObject.msg = 'Username does not exist!';
      returnObject.code = ApiCode.INVALID_INPUT_PARAM;
      res.json(returnObject);
      return;
    }

    users.splice(userIndex, 1);
    fs.writeFileSync(userManager.userFile, JSON.stringify(userFile, null, 2), 'utf8');
    returnObject.msg = 'Account deleted successfully!';
    returnObject.code = ApiCode.OK;
    res.json(returnObject);
  }
  catch (err) {
    next(err);
  }
}

async function  apiLogin(req, res, next) {
  try {
    const returnObject = createApiObj();
    const { username, password } = req.body;

    if (!username || !password) {
      returnObject.msg = 'Account name and password cannot be empty!';
      returnObject.code = ApiCode.INVALID_CREDENTIALS;
      return res.json(returnObject);
    }

    const users = getUsers();
    let verified = false;
    let user = null;
    for( let i = 0; i < users.length; i++) {
      user = users[i];
      const psVerified = await verifiedHash(password, user.password);
      if( (user.username === username) &&   psVerified) {
        verified = true;
        break;
      }
    }

    if (verified === false) {
      returnObject.msg = 'The username or password is incorrect!';
      returnObject.code = ApiCode.INVALID_CREDENTIALS;
      return res.json(returnObject);
    }
    const expiresTime = 12; // h
    const token = jwt.sign({ username: user.username }, JWT_SECRET, {
      expiresIn: `${expiresTime}h`
    });
    returnObject.msg = 'Login sucessful';
    returnObject.code = ApiCode.OK;
    returnObject.data = {
      token,
      username
    };
    res.json(returnObject);
  } catch (err) {
    next(err);
  }
}

async function changeAccount(oriUsername, newUsername, newPassword) {
  try {
    // Read the configuration file to get the user file path
    const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const userFilePath = configData.userManager.userFile;

    // Read the user file content
    const userContent = await fsPromises.readFile(userFilePath, 'utf8');
    const users = JSON.parse(userContent);

    let userFound = false;

    // Iterate through all user arrays
    for (let account of users.Accounts) {
      // Find the user object by oriUsername
      if (account.username === oriUsername) {
        // Update the username and password
        account.username = newUsername;
        account.password = await hashEncrypt(newPassword);
        userFound = true;
        break;
      }
    }

    if (!userFound) {
      logger.error(`Error: User ${oriUsername} not found`);
      return false;
    }

    // Convert the updated object back to JSON format
    const updatedJsonContent = JSON.stringify(users, null, 2);

    // Write the updated content back to the JSON file
    await fsPromises.writeFile(userFilePath, updatedJsonContent, 'utf8');

    return true;
  } catch (error) {
    logger.error(`Error during account update: ${error}`);
    return false;
  }
}

async function apiUpdateAccount(req, res, next) {
  try {
    const { newUsername, newPassword } = req.body;
    const oriUsername = req.headers.username;
    const response = await changeAccount(oriUsername, newUsername, newPassword);
    if (response) {
      res.json({
        code: ApiCode.OK,
        msg: 'Account updated successfully'
      });
    } else {
      res.json({
        code: ApiCode.ERROR,
        msg: 'Error updating account'
      });
    }
  } catch (err) {
    next(err);
  }
}

export { apiLogin, apiUpdateAccount, apiGetUserList, apiCreateAccount, apiDeleteAccount };
