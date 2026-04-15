/**
 * LLM Service Tests — failover chain, circuit breaker, prompt injection
 */
import { describe, test, expect, beforeEach } from 'vitest';

// Direct module tests (no server needed)
describe('LLM Service', () => {
  let llm;

  beforeEach(() => {
    // Clear module cache to reset state
    delete require.cache[require.resolve('../services/llmService')];
    // Set minimal env
    process.env.LLM_PROVIDERS = 'ollama';
    llm = require('../services/llmService');
  });

  test('getProviderOrder parses comma-separated LLM_PROVIDERS', () => {
    process.env.LLM_PROVIDERS = 'ollama,openai,gemini';
    delete require.cache[require.resolve('../services/llmService')];
    llm = require('../services/llmService');
    const order = llm.getProviderOrder();
    expect(order).toEqual(['ollama', 'openai', 'gemini']);
  });

  test('getProviderOrder filters invalid providers', () => {
    process.env.LLM_PROVIDERS = 'ollama,invalid,gemini';
    delete require.cache[require.resolve('../services/llmService')];
    llm = require('../services/llmService');
    const order = llm.getProviderOrder();
    expect(order).toEqual(['ollama', 'gemini']);
  });

  test('setProviderOrder updates priority', () => {
    llm.setProviderOrder(['gemini', 'openai']);
    expect(llm.getProviderOrder()).toEqual(['gemini', 'openai']);
  });

  test('isConfigured returns true when providers set', () => {
    expect(llm.isConfigured()).toBe(true);
  });

  test('isConfigured returns false when no providers', () => {
    delete process.env.LLM_PROVIDERS;
    delete process.env.LLM_PROVIDER;
    delete require.cache[require.resolve('../services/llmService')];
    llm = require('../services/llmService');
    expect(llm.isConfigured()).toBe(false);
  });

  test('isDangerous catches rm -rf /', () => {
    expect(llm.isDangerous('rm -rf /')).toBe(true);
    expect(llm.isDangerous('rm -rf ~/Documents')).toBe(true);
    expect(llm.isDangerous('echo hello')).toBe(false);
  });

  test('cleanResponse strips markdown code blocks', () => {
    expect(llm.cleanResponse('```bash\nls -la\n```')).toBe('ls -la');
    expect(llm.cleanResponse('$ ls -la')).toBe('ls -la');
    expect(llm.cleanResponse('ls -la')).toBe('ls -la');
  });

  test('getProvidersInfo returns all providers with health', () => {
    const info = llm.getProvidersInfo();
    expect(info.length).toBe(3); // ollama, openai, gemini
    expect(info[0]).toHaveProperty('name');
    expect(info[0]).toHaveProperty('health');
    expect(info[0].health).toHaveProperty('failures');
    expect(info[0].health).toHaveProperty('circuitOpen');
  });

  test('callWithFailover throws when no providers configured', async () => {
    delete process.env.LLM_PROVIDERS;
    delete process.env.LLM_PROVIDER;
    delete require.cache[require.resolve('../services/llmService')];
    llm = require('../services/llmService');
    await expect(llm.callWithFailover([{ role: 'user', content: 'test' }]))
      .rejects.toThrow('No LLM providers configured');
  });

  test('getPromptFiles returns boot, soul, agents', () => {
    const files = llm.getPromptFiles();
    expect(files).toHaveProperty('boot');
    expect(files).toHaveProperty('soul');
    expect(files).toHaveProperty('agents');
  });

  test('getInjectedSystemPrompt combines prompt files with base prompt', () => {
    const result = llm.getInjectedSystemPrompt('Base prompt');
    expect(result).toContain('Base prompt');
  });
});
