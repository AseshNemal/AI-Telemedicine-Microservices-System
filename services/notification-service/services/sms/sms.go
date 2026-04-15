package sms

import (
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
)

type Client struct {
	AccountSID string
	AuthToken  string
	From       string
}

func NewClient(accountSID, authToken, from string) *Client {
	return &Client{AccountSID: accountSID, AuthToken: authToken, From: from}
}

var e164Pattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)

// normalizePhoneToE164 converts common local formats (e.g. 0771234567) to E.164.
// Uses DEFAULT_COUNTRY_CODE (without + or with +) from env, fallback: +94.
func normalizePhoneToE164(raw string) (string, error) {
	// Keep leading '+' while stripping visual separators.
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.ReplaceAll(cleaned, " ", "")
	cleaned = strings.ReplaceAll(cleaned, "-", "")
	cleaned = strings.ReplaceAll(cleaned, "(", "")
	cleaned = strings.ReplaceAll(cleaned, ")", "")

	if cleaned == "" {
		return "", errors.New("empty destination phone number")
	}

	// 00XXXXXXXX -> +XXXXXXXX
	if strings.HasPrefix(cleaned, "00") {
		cleaned = "+" + strings.TrimPrefix(cleaned, "00")
	}

	// Local format 0XXXXXXXXX -> +<countrycode>XXXXXXXXX
	if strings.HasPrefix(cleaned, "0") {
		country := strings.TrimSpace(os.Getenv("DEFAULT_COUNTRY_CODE"))
		if country == "" {
			country = "+94"
		}
		if !strings.HasPrefix(country, "+") {
			country = "+" + country
		}
		cleaned = country + strings.TrimPrefix(cleaned, "0")
	}

	// If still no +, assume country code prefix is required.
	if !strings.HasPrefix(cleaned, "+") {
		country := strings.TrimSpace(os.Getenv("DEFAULT_COUNTRY_CODE"))
		if country == "" {
			country = "+94"
		}
		if !strings.HasPrefix(country, "+") {
			country = "+" + country
		}
		cleaned = country + cleaned
	}

	if !e164Pattern.MatchString(cleaned) {
		return "", fmt.Errorf("phone number must be E.164 format, got %q", raw)
	}

	return cleaned, nil
}

func (c *Client) SendSMS(to, message string) error {
	if c == nil {
		return errors.New("sms client not configured")
	}
	if c.AccountSID == "" || c.AuthToken == "" || c.From == "" {
		return errors.New("sms client missing credentials")
	}

	normalizedTo, err := normalizePhoneToE164(to)
	if err != nil {
		return err
	}

	endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", c.AccountSID)
	data := url.Values{}
	data.Set("To", normalizedTo)
	data.Set("From", c.From)
	data.Set("Body", message)

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.AccountSID, c.AuthToken)
	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		b, _ := ioutil.ReadAll(resp.Body)
		return fmt.Errorf("twilio error: status=%d body=%s", resp.StatusCode, string(b))
	}
	return nil
}
