import axios from 'axios';
import { Tool, ToolDefinition, ToolResult } from './types';
import { logger } from '../utils/logger';

export class WebFetchTool implements Tool {
  definition: ToolDefinition = {
    name: 'WebFetch',
    description: 'Fetch content from a URL and return it as text. Useful for reading documentation, APIs, or web pages.',
    parameters: [
      {
        name: 'url',
        type: 'string',
        description: 'The URL to fetch content from (must be a valid HTTP/HTTPS URL)',
        required: true,
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in milliseconds (default: 10000)',
        required: false,
        default: 10000,
      },
      {
        name: 'headers',
        type: 'object',
        description: 'Optional HTTP headers to include in the request',
        required: false,
      },
    ],
  };

  private cache: Map<string, { content: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const { url, timeout = 10000, headers = {} } = params;

    try {
      if (!url) {
        return {
          success: false,
          error: 'url parameter is required',
        };
      }

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);

        // Auto-upgrade HTTP to HTTPS
        if (parsedUrl.protocol === 'http:') {
          parsedUrl.protocol = 'https:';
          logger.info(`Auto-upgraded to HTTPS: ${parsedUrl.href}`);
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return {
            success: false,
            error: `Invalid URL protocol: ${parsedUrl.protocol}. Only HTTP/HTTPS are supported.`,
          };
        }
      } catch (error: any) {
        return {
          success: false,
          error: `Invalid URL: ${error.message}`,
        };
      }

      const finalUrl = parsedUrl.href;

      // Check cache
      const cached = this.cache.get(finalUrl);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.tool('WebFetch', `Retrieved from cache: ${finalUrl}`);
        return {
          success: true,
          output: cached.content,
          data: {
            url: finalUrl,
            cached: true,
            length: cached.content.length,
          },
        };
      }

      logger.tool('WebFetch', `Fetching: ${finalUrl}`);

      // Fetch content
      const response = await axios.get(finalUrl, {
        timeout,
        headers: {
          'User-Agent': 'G-Coder/2.0 (AI Coding Assistant)',
          ...headers,
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      // Check for redirects to different hosts
      if (response.request?.res?.responseUrl) {
        const responseUrl = new URL(response.request.res.responseUrl);
        if (responseUrl.host !== parsedUrl.host) {
          return {
            success: false,
            error: `Redirected to different host: ${responseUrl.host}. Please fetch directly: ${responseUrl.href}`,
            output: `REDIRECT: ${responseUrl.href}`,
          };
        }
      }

      let content = response.data;

      // Convert to string if needed
      if (typeof content !== 'string') {
        content = JSON.stringify(content, null, 2);
      }

      // Simple HTML to markdown conversion
      if (response.headers['content-type']?.includes('text/html')) {
        content = this.htmlToMarkdown(content);
      }

      // Limit size
      const maxSize = 100000; // 100KB
      if (content.length > maxSize) {
        content = content.substring(0, maxSize) + '\n\n[... Content truncated due to size ...]';
      }

      // Cache result
      this.cache.set(finalUrl, {
        content,
        timestamp: Date.now(),
      });

      logger.tool('WebFetch', `Fetched ${content.length} characters from ${finalUrl}`);

      return {
        success: true,
        output: content,
        data: {
          url: finalUrl,
          statusCode: response.status,
          contentType: response.headers['content-type'],
          length: content.length,
          cached: false,
        },
      };
    } catch (error: any) {
      if (error.response) {
        return {
          success: false,
          error: `HTTP ${error.response.status}: ${error.response.statusText}`,
          data: {
            statusCode: error.response.status,
            url,
          },
        };
      } else if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: `Domain not found: ${url}`,
        };
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: `Request timeout after ${timeout}ms`,
        };
      } else {
        return {
          success: false,
          error: `Failed to fetch URL: ${error.message}`,
        };
      }
    }
  }

  private htmlToMarkdown(html: string): string {
    // Very basic HTML to markdown conversion
    let text = html;

    // Remove scripts and styles
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Convert headers
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');

    // Convert links
    text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Convert paragraphs and breaks
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Convert lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');

    // Convert code blocks
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    text = text.replace(/<pre[^>]*>(.*?)<\/pre>/gi, '\n```\n$1\n```\n');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");

    // Clean up excessive whitespace
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.trim();

    return text;
  }

  // Clear cache (useful for testing)
  clearCache(): void {
    this.cache.clear();
  }
}
