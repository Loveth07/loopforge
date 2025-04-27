import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Constants for test data
const TEST_DEVICE_ID = '0x01';
const TEST_METADATA = 'Test Device Metadata';

Clarinet.test({
  name: "Device Registry: Initial Contract State",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Attempt to initialize contract with deployer
    const block = chain.mineBlock([
      Tx.contractCall('device_registry', 'init-contract', [], deployer.address)
    ]);

    // Verify initialization was successful
    block.receipts[0].result.expectOk().expectBool(true);
  }
});

Clarinet.test({
  name: "Device Registry: Successful Device Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const deviceManager = accounts.get('wallet_1')!;

    // Initialize contract and assign device manager role
    let block = chain.mineBlock([
      Tx.contractCall('device_registry', 'init-contract', [], deployer.address),
      Tx.contractCall('device_registry', 'assign-role', 
        [types.principal(deviceManager.address), types.uint(2)], 
        deployer.address
      )
    ]);

    // Register device as device manager
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'register-device', 
        [types.buff(TEST_DEVICE_ID), types.utf8(TEST_METADATA)], 
        deviceManager.address
      )
    ]);

    // Verify successful registration
    block.receipts[0].result.expectOk().expectBool(true);

    // Check device info
    const deviceInfo = chain.callReadOnlyFn(
      'device_registry', 
      'get-device-info', 
      [types.buff(TEST_DEVICE_ID)], 
      deviceManager.address
    );

    // Verify device details
    deviceInfo.result.expectSome();
    const deviceData = deviceInfo.result.expectSome().expectTuple();
    assertEquals(deviceData.owner, deviceManager.address);
    assertEquals(deviceData.metadata, TEST_METADATA);
    assertEquals(deviceData.status, 1n); // DEVICE_STATUS_ACTIVE
  }
});

Clarinet.test({
  name: "Device Registry: Prevent Duplicate Device Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const deviceManager = accounts.get('wallet_1')!;

    // Initialize contract and assign device manager role
    let block = chain.mineBlock([
      Tx.contractCall('device_registry', 'init-contract', [], deployer.address),
      Tx.contractCall('device_registry', 'assign-role', 
        [types.principal(deviceManager.address), types.uint(2)], 
        deployer.address
      )
    ]);

    // First registration
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'register-device', 
        [types.buff(TEST_DEVICE_ID), types.utf8(TEST_METADATA)], 
        deviceManager.address
      )
    ]);

    // Attempt duplicate registration
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'register-device', 
        [types.buff(TEST_DEVICE_ID), types.utf8(TEST_METADATA)], 
        deviceManager.address
      )
    ]);

    // Verify duplicate registration fails
    block.receipts[0].result.expectErr().expectUint(402); // ERR_DEVICE_EXISTS
  }
});

Clarinet.test({
  name: "Device Registry: Unauthorized Device Registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const randomUser = accounts.get('wallet_2')!;

    // Initialize contract
    chain.mineBlock([
      Tx.contractCall('device_registry', 'init-contract', [], deployer.address)
    ]);

    // Attempt registration by unauthorized user
    const block = chain.mineBlock([
      Tx.contractCall('device_registry', 'register-device', 
        [types.buff(TEST_DEVICE_ID), types.utf8(TEST_METADATA)], 
        randomUser.address
      )
    ]);

    // Verify unauthorized registration fails
    block.receipts[0].result.expectErr().expectUint(401); // ERR_UNAUTHORIZED
  }
});

Clarinet.test({
  name: "Device Registry: Transfer Device Ownership",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const deviceManager = accounts.get('wallet_1')!;
    const newOwner = accounts.get('wallet_2')!;

    // Initialize contract and assign device manager role
    let block = chain.mineBlock([
      Tx.contractCall('device_registry', 'init-contract', [], deployer.address),
      Tx.contractCall('device_registry', 'assign-role', 
        [types.principal(deviceManager.address), types.uint(2)], 
        deployer.address
      )
    ]);

    // Register device
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'register-device', 
        [types.buff(TEST_DEVICE_ID), types.utf8(TEST_METADATA)], 
        deviceManager.address
      )
    ]);

    // Transfer ownership
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'transfer-device-ownership', 
        [types.buff(TEST_DEVICE_ID), types.principal(newOwner.address)], 
        deviceManager.address
      )
    ]);

    // Verify ownership transfer
    block.receipts[0].result.expectOk().expectBool(true);

    // Check updated device info
    const deviceInfo = chain.callReadOnlyFn(
      'device_registry', 
      'get-device-info', 
      [types.buff(TEST_DEVICE_ID)], 
      newOwner.address
    );

    // Verify new owner
    deviceInfo.result.expectSome();
    const deviceData = deviceInfo.result.expectSome().expectTuple();
    assertEquals(deviceData.owner, newOwner.address);
  }
});

Clarinet.test({
  name: "Device Registry: Change Device Status",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const deviceManager = accounts.get('wallet_1')!;

    // Initialize contract and assign device manager role
    let block = chain.mineBlock([
      Tx.contractCall('device_registry', 'init-contract', [], deployer.address),
      Tx.contractCall('device_registry', 'assign-role', 
        [types.principal(deviceManager.address), types.uint(2)], 
        deployer.address
      )
    ]);

    // Register device
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'register-device', 
        [types.buff(TEST_DEVICE_ID), types.utf8(TEST_METADATA)], 
        deviceManager.address
      )
    ]);

    // Change device status (by admin/deployer)
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'change-device-status', 
        [types.buff(TEST_DEVICE_ID), types.uint(2)], // DEVICE_STATUS_INACTIVE
        deployer.address
      )
    ]);

    // Verify status change
    block.receipts[0].result.expectOk().expectBool(true);

    // Check updated device status
    const deviceStatus = chain.callReadOnlyFn(
      'device_registry', 
      'get-device-status', 
      [types.buff(TEST_DEVICE_ID)], 
      deployer.address
    );

    // Verify status
    deviceStatus.result.expectSome().expectUint(2); // DEVICE_STATUS_INACTIVE
  }
});

Clarinet.test({
  name: "Device Registry: Role Management",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const newAdmin = accounts.get('wallet_1')!;

    // Initialize contract
    let block = chain.mineBlock([
      Tx.contractCall('device_registry', 'init-contract', [], deployer.address)
    ]);

    // Assign role to new admin
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'assign-role', 
        [types.principal(newAdmin.address), types.uint(1)], // ROLE_ADMIN
        deployer.address
      )
    ]);

    // Verify role assignment
    block.receipts[0].result.expectOk().expectBool(true);

    // Unauthorized role assignment attempt
    block = chain.mineBlock([
      Tx.contractCall('device_registry', 'assign-role', 
        [types.principal(newAdmin.address), types.uint(1)], 
        newAdmin.address // Unauthorized user
      )
    ]);

    // Verify unauthorized role assignment fails
    block.receipts[0].result.expectErr().expectUint(401); // ERR_UNAUTHORIZED
  }
});