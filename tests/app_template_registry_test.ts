import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Constants for test data
const TEST_TEMPLATE_ID = 'test-template-001-valid';
const TEST_TEMPLATE_NAME = 'IoT Monitoring App';
const TEST_TEMPLATE_DESC = 'A template for monitoring IoT devices';
const TEST_TEMPLATE_VERSION = '1.0.0';
const TEST_METADATA_URI = 'https://example.com/template-metadata';

Clarinet.test({
  name: "App Template Registry: Successful Template Submission",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Submit a new template
    const block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Verify successful submission
    block.receipts[0].result.expectOk().expectBool(true);

    // Retrieve template details
    const templateDetails = chain.callReadOnlyFn(
      'app_template_registry', 
      'get-template-details', 
      [types.ascii(TEST_TEMPLATE_ID)], 
      deployer.address
    );

    // Validate template metadata
    templateDetails.result.expectSome();
    const templateData = templateDetails.result.expectSome().expectTuple();
    assertEquals(templateData.name, TEST_TEMPLATE_NAME);
    assertEquals(templateData.description, TEST_TEMPLATE_DESC);
    assertEquals(templateData.version, TEST_TEMPLATE_VERSION);
    assertEquals(templateData.is_deprecated, false);
  }
});

Clarinet.test({
  name: "App Template Registry: Prevent Duplicate Template Submission",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Submit first template
    let block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Attempt duplicate submission
    block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Verify duplicate submission fails
    block.receipts[0].result.expectErr().expectUint(409); // ERR_TEMPLATE_ALREADY_EXISTS
  }
});

Clarinet.test({
  name: "App Template Registry: Invalid Template Submission",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Attempt to submit template with invalid ID (too short)
    const block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii('ab'),  // Invalid ID (less than 3 chars)
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Verify invalid submission fails
    block.receipts[0].result.expectErr().expectUint(400); // ERR_INVALID_VERSION
  }
});

Clarinet.test({
  name: "App Template Registry: Update Template Metadata",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Submit initial template
    let block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Update template metadata
    block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'update-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii('Updated IoT Monitoring App'),
        types.ascii('Enhanced IoT device monitoring'),
        types.ascii('https://example.com/updated-metadata')
      ], deployer.address)
    ]);

    // Verify successful update
    block.receipts[0].result.expectOk().expectBool(true);

    // Retrieve updated template details
    const templateDetails = chain.callReadOnlyFn(
      'app_template_registry', 
      'get-template-details', 
      [types.ascii(TEST_TEMPLATE_ID)], 
      deployer.address
    );

    // Validate updated metadata
    templateDetails.result.expectSome();
    const templateData = templateDetails.result.expectSome().expectTuple();
    assertEquals(templateData.name, 'Updated IoT Monitoring App');
    assertEquals(templateData.description, 'Enhanced IoT device monitoring');
    assertEquals(templateData.metadata_uri, 'https://example.com/updated-metadata');
  }
});

Clarinet.test({
  name: "App Template Registry: Deprecate Template",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Submit initial template
    let block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Deprecate template
    block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'deprecate-template', [
        types.ascii(TEST_TEMPLATE_ID)
      ], deployer.address)
    ]);

    // Verify successful deprecation
    block.receipts[0].result.expectOk().expectBool(true);

    // Retrieve template details
    const templateDetails = chain.callReadOnlyFn(
      'app_template_registry', 
      'get-template-details', 
      [types.ascii(TEST_TEMPLATE_ID)], 
      deployer.address
    );

    // Validate deprecation status
    templateDetails.result.expectSome();
    const templateData = templateDetails.result.expectSome().expectTuple();
    assertEquals(templateData.is_deprecated, true);
  }
});

Clarinet.test({
  name: "App Template Registry: Template Version Tracking",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;

    // Submit initial template
    let block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Retrieve initial version details
    const versionDetails = chain.callReadOnlyFn(
      'app_template_registry', 
      'get-template-version', 
      [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_VERSION)
      ], 
      deployer.address
    );

    // Validate version details
    versionDetails.result.expectSome();
    const versionData = versionDetails.result.expectSome().expectTuple();
    assertEquals(versionData.changelog, 'Initial version');
    assertEquals(versionData.approved_by, deployer.address);
  }
});

Clarinet.test({
  name: "App Template Registry: Unauthorized Template Update",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const randomUser = accounts.get('wallet_1')!;

    // Submit initial template
    let block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'submit-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii(TEST_TEMPLATE_NAME),
        types.ascii(TEST_TEMPLATE_DESC),
        types.ascii(TEST_TEMPLATE_VERSION),
        types.ascii(TEST_METADATA_URI)
      ], deployer.address)
    ]);

    // Attempt unauthorized template update
    block = chain.mineBlock([
      Tx.contractCall('app_template_registry', 'update-template', [
        types.ascii(TEST_TEMPLATE_ID),
        types.ascii('Unauthorized Update'),
        types.ascii('Unauthorized description'),
        types.ascii('https://example.com/unauthorized')
      ], randomUser.address)
    ]);

    // Verify unauthorized update fails
    block.receipts[0].result.expectErr().expectUint(403); // ERR_UNAUTHORIZED
  }
});