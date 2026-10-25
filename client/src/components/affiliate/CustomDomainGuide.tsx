import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CustomDomainGuideProps {
  storefrontSlug: string;
  defaultDomain: string;
}

export function CustomDomainGuide({
  storefrontSlug,
  defaultDomain,
}: CustomDomainGuideProps) {
  const defaultUrl = `https://${defaultDomain}`;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              Point Your Custom Domain
            </CardTitle>
            <CardDescription>
              Use your own domain instead of the default Cabinet Dealz subdomain
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <Alert className="border-blue-200 bg-white">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Your current storefront URL:</strong>
            <br />
            <code className="mt-1 block rounded bg-gray-100 p-2 text-sm">
              {defaultUrl}
            </code>
          </AlertDescription>
        </Alert>

        {/* Step-by-Step Tabs */}
        <Tabs defaultValue="step1" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="step1" className="text-xs">
              1. Prepare
            </TabsTrigger>
            <TabsTrigger value="step2" className="text-xs">
              2. Get Address
            </TabsTrigger>
            <TabsTrigger value="step3" className="text-xs">
              3. DNS
            </TabsTrigger>
            <TabsTrigger value="step4" className="text-xs">
              4. Wait
            </TabsTrigger>
            <TabsTrigger value="step5" className="text-xs">
              5. Test
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Prepare Domain */}
          <TabsContent value="step1" className="space-y-3 rounded-lg border border-blue-200 bg-white p-4">
            <h3 className="font-semibold">Step 1: Prepare Your Domain</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
                <span>
                  You must own or have admin access to the domain you want to use
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
                <span>
                  The domain should be registered with a registrar (GoDaddy, Namecheap, etc.)
                </span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 mt-0.5" />
                <span>
                  You'll need to modify the domain's DNS records in your registrar's control panel
                </span>
              </li>
            </ul>
          </TabsContent>

          {/* Step 2: Get Target Address */}
          <TabsContent value="step2" className="space-y-3 rounded-lg border border-blue-200 bg-white p-4">
            <h3 className="font-semibold">Step 2: Get Your Target Address</h3>
            <p className="text-sm text-gray-600">
              This is the address your custom domain will point to:
            </p>
            <div className="rounded bg-gray-100 p-3">
              <code className="text-sm font-mono">{defaultUrl}</code>
            </div>
            <p className="text-xs text-gray-500">
              Copy this address — you'll use it in the next step when updating your DNS records.
            </p>
          </TabsContent>

          {/* Step 3: Update DNS */}
          <TabsContent value="step3" className="space-y-4 rounded-lg border border-blue-200 bg-white p-4">
            <h3 className="font-semibold">Step 3: Update DNS Records</h3>
            <p className="text-sm text-gray-600">
              Log in to your domain registrar's DNS management panel and add/update these records:
            </p>

            <div className="space-y-3">
              {/* CNAME Option */}
              <div className="rounded border border-green-200 bg-green-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">Option A: CNAME (Recommended)</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        CNAME records are the preferred way to point domains. They're more flexible
                        and easier to manage.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-1 text-sm font-mono bg-white rounded p-2">
                  <div>
                    <span className="text-gray-500">Type:</span> <span>CNAME</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Name:</span> <span>@</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Value:</span>{" "}
                    <span>{defaultDomain}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">TTL:</span> <span>3600</span>
                  </div>
                </div>
              </div>

              {/* A Record Option */}
              <div className="rounded border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">Option B: A Record (if CNAME unavailable)</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Use A records only if your registrar doesn't support CNAME for the root domain.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-1 text-sm font-mono bg-white rounded p-2">
                  <div>
                    <span className="text-gray-500">Type:</span> <span>A</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Name:</span> <span>@</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Value:</span> <span>76.76.19.165</span>
                  </div>
                  <div>
                    <span className="text-gray-500">TTL:</span> <span>3600</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Step 4: Wait for Propagation */}
          <TabsContent value="step4" className="space-y-3 rounded-lg border border-blue-200 bg-white p-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              Step 4: Wait for DNS Propagation
            </h3>
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription>
                DNS changes can take <strong>24–48 hours</strong> to fully propagate worldwide.
              </AlertDescription>
            </Alert>
            <div className="space-y-2 text-sm">
              <p>
                During this time, some visitors may still see the old domain. This is normal.
              </p>
              <p>
                <strong>Check propagation status:</strong>
              </p>
              <a
                href="https://dnschecker.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-blue-600 hover:underline"
              >
                https://dnschecker.org
              </a>
            </div>
          </TabsContent>

          {/* Step 5: Test */}
          <TabsContent value="step5" className="space-y-3 rounded-lg border border-blue-200 bg-white p-4">
            <h3 className="font-semibold">Step 5: Test Your Domain</h3>
            <div className="space-y-2 text-sm">
              <p>Once DNS has propagated, test your custom domain:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Visit your custom domain in a browser</li>
                <li>You should see your storefront (not the main Cabinet Dealz site)</li>
                <li>Check that your logo, colors, and branding appear correctly</li>
              </ul>
            </div>
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                If everything looks right, your custom domain is live! 🎉
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Troubleshooting */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Troubleshooting
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Domain shows main Cabinet Dealz site:</strong>
              <ul className="ml-4 mt-1 list-disc text-gray-600 space-y-1">
                <li>Wait 24–48 hours for full DNS propagation</li>
                <li>Verify your DNS records are correct</li>
                <li>Clear your browser cache (Ctrl+Shift+Delete)</li>
              </ul>
            </div>
            <div className="mt-2">
              <strong>Domain shows "Connection refused":</strong>
              <ul className="ml-4 mt-1 list-disc text-gray-600 space-y-1">
                <li>Check that the CNAME or A record value is correct</li>
                <li>Verify your registrar saved the changes</li>
                <li>Try a different DNS record type</li>
              </ul>
            </div>
            <div className="mt-2">
              <strong>SSL certificate warning:</strong>
              <ul className="ml-4 mt-1 list-disc text-gray-600 space-y-1">
                <li>Cabinet Dealz handles SSL automatically</li>
                <li>If you see a warning, wait a few hours and refresh</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Support */}
        <Alert className="border-blue-200 bg-blue-50">
          <HelpCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>Need help?</strong> Contact your account manager or email{" "}
            <a href="mailto:support@cabinetdealz.com" className="text-blue-600 hover:underline">
              support@cabinetdealz.com
            </a>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
