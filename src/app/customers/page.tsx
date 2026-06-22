"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ValidatedInput } from "@/components/ui/validated-input";
import { ValidatedTextarea } from "@/components/ui/validated-textarea";
import { ValidationRules } from "@/lib/validation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Printer,
  Plus,
  Edit,
  Trash2,
  Archive,
  RotateCw,
  DollarSign,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { customersAPI } from "@/lib/api";
import {
  validateRequired,
  validateEmail,
  validateAustralianPhone,
} from "@/lib/validations";
import {
  formatAustralianPhone,
  cleanPhoneNumber,
  getPhonePlaceholder,
  isValidAustralianPhoneFormat,
  getPhoneValidationError,
} from "@/lib/phone-mask";
import { printTableData } from "@/lib/print-utils";

interface Customer {
  customer_id: number;
  firstname: string;
  lastname: string;
  email: string;
  telephone: string;
  customer_address: string;
  customer_type: string;
  customer_cost_centre?: string;
  customer_notes?: string;
  customer_image?: string;
  estimated_opening_date?: string;
  discount_percentage?: number | null;
  status: number;
  archived: boolean;
  company_id?: number;
  department_id?: number;
  created_from?: string;
  approved?: boolean;
  pay_later?: boolean;
  company_name?: string;
  department_name?: string;
  has_similar_company?: boolean;
  similar_companies?: Array<{ company_id: number; company_name: string }>;
  company?: {
    company_id: number;
    company_name: string;
  };
  department?: {
    department_id: number;
    department_name: string;
  };
}

interface Company {
  company_id: number;
  company_name: string;
}

interface Department {
  department_id: number;
  department_name: string;
  company_id: number;
}

const customerTypes = [
  "Retail",
  "Club Members",
  "Subscriber",
  "Full Service Wholesale",
  "Partial Service Wholesale",
];

function CustomersContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(searchParams.get("type") || "Retail");
  const [activeTab, setActiveTab] = useState<
    "Active" | "Archived" | "Pending Approval"
  >((searchParams.get("tab") as any) || "Active");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [mapCompanyCustomer, setMapCompanyCustomer] = useState<any>(null);
  const [mappingCompany, setMappingCompany] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  // Reset active tab to "Active" if switching to Retail (which has no pending approvals)
  useEffect(() => {
    if (selectedType === "Retail" && activeTab === "Pending Approval") {
      setActiveTab("Active");
    }
  }, [selectedType, activeTab]);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "archive" | "delete" | null
  >(null);
  const [confirmCustomerId, setConfirmCustomerId] = useState<number | null>(
    null
  );
  const [confirmCustomerName, setConfirmCustomerName] = useState("");

  // Form State
  const [customerType, setCustomerType] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [costCentre, setCostCentre] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [estimatedOpeningDate, setEstimatedOpeningDate] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState<string>("");
  const [payLater, setPayLater] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{
    customerType?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    telephone?: string;
    customer_address?: string;
    customer_cost_centre?: string;
    customer_notes?: string;
  }>({});

  // Fetch customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ["customers", selectedType, activeTab, searchQuery],
    queryFn: async () => {
      if (activeTab === "Pending Approval") {
        // Fetch pending approval customers (wholesale from frontend)
        const params = new URLSearchParams({
          limit: "100",
        });
        if (searchQuery) params.append("search", searchQuery);

        const response = await customersAPI.listPendingApproval(params);
        return response.data;
      } else {
        // Regular customers list
        const params = new URLSearchParams({
          archived: (activeTab === "Archived").toString(),
          limit: "100",
        });
        if (selectedType && selectedType.trim() !== "") {
          params.append("customer_type", selectedType);
        }
        if (searchQuery) params.append("search", searchQuery);

        const response = await api.get(`/admin/customers?${params}`);
        return response.data;
      }
    },
  });

  // Fetch active count for the selected type
  const { data: activeCountData } = useQuery({
    queryKey: ["customers-count", selectedType, "active"],
    queryFn: async () => {
      const params = new URLSearchParams({
        customer_type: selectedType,
        archived: "false",
        limit: "0",
      });
      const response = await api.get(`/admin/customers?${params}`);
      return response.data;
    },
  });

  // Fetch archived count for the selected type
  const { data: archivedCountData } = useQuery({
    queryKey: ["customers-count", selectedType, "archived"],
    queryFn: async () => {
      const params = new URLSearchParams({
        customer_type: selectedType,
        archived: "true",
        limit: "0",
      });
      const response = await api.get(`/admin/customers?${params}`);
      return response.data;
    },
  });

  // Fetch pending approval count
  const { data: pendingCountData } = useQuery({
    queryKey: ["customers-count", "pending-approval"],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "0",
      });
      const response = await customersAPI.listPendingApproval(params);
      const data = response.data;
      // API returns { count, customers } or { total, data } or just array
      if (Array.isArray(data)) {
        return { count: data.length };
      }
      if (data.count !== undefined) {
        return { count: data.count };
      }
      if (data.total !== undefined) {
        return { count: data.total };
      }
      return { count: 0 };
    },
  });

  // Fetch companies
  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await api.get("/admin/companies");
      return response.data;
    },
  });

  // Fetch departments for selected company
  const { data: departmentsData } = useQuery({
    queryKey: ["departments", selectedCompany],
    enabled: !!selectedCompany,
    queryFn: async () => {
      const response = await api.get(
        `/admin/companies/departments/list?company_id=${selectedCompany}`
      );
      return response.data;
    },
  });

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post("/admin/customers", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer created successfully!");
      setShowAddModal(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create customer");
    },
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await api.put(`/admin/customers/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated successfully!");
      setShowEditModal(false);
      setSelectedCustomer(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update customer");
    },
  });

  // Archive customer mutation
  const archiveCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/admin/customers/${id}/archive`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count"] });
      toast.success("Customer archived successfully!");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to archive customer"
      );
    },
  });

  // Restore customer mutation
  const restoreCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/admin/customers/${id}/restore`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count"] });
      toast.success("Customer restored successfully!");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to restore customer"
      );
    },
  });

  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/admin/customers/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete customer");
    },
  });

  // Approve customer mutation
  const approveCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await customersAPI.approve(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customers-count", "pending-approval"],
      });
      toast.success("Customer approved successfully!");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Failed to approve customer"
      );
    },
  });

  // Reject customer mutation
  const rejectCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await customersAPI.reject(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customers-count", "pending-approval"],
      });
      toast.success("Customer rejected successfully!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to reject customer");
    },
  });

  const customers = customersData?.customers || [];
  const companies = companiesData?.companies || [];
  const departments = departmentsData?.departments || [];

  const handleAddCustomer = () => {
    setShowAddModal(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerType(customer.customer_type);
    setFirstname(customer.firstname);
    setLastname(customer.lastname);
    setPhoneNumber(customer.telephone || "");
    setCustomerEmail(customer.email || "");
    setAddress(customer.customer_address || "");
    setAdditionalNotes(customer.customer_notes || "");
    setCostCentre(customer.customer_cost_centre || "");
    setSelectedCompany(customer.company_id?.toString() || "");
    setSelectedDepartment(customer.department_id?.toString() || "");
    setEstimatedOpeningDate(customer.estimated_opening_date || "");
    setDiscountPercentage(customer.discount_percentage?.toString() || "");
    setPayLater(customer.pay_later || false);
    setShowEditModal(true);
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Validate customer type (required, max 100 chars per migration)
    const customerTypeValidation = validateRequired(
      customerType,
      "Customer type",
      100
    );
    if (!customerTypeValidation.valid) {
      newErrors.customerType =
        customerTypeValidation.error || "Customer type is required";
    }

    // Validate firstname (required, max 255 chars per DB schema)
    const firstnameValidation = validateRequired(firstname, "First name", 255);
    if (!firstnameValidation.valid) {
      newErrors.firstname =
        firstnameValidation.error || "First name is required";
    }

    // Validate lastname (optional, max 255 chars per DB schema)
    if (lastname && lastname.trim() !== "") {
      const lastnameValidation = validateRequired(lastname, "Last name", 255);
      if (!lastnameValidation.valid) {
        newErrors.lastname = lastnameValidation.error || "Last name is invalid";
      }
    }

    // Validate email (optional, max 255 chars per DB schema, must be valid format)
    if (customerEmail && customerEmail.trim() !== "") {
      const emailValidation = validateEmail(customerEmail, 255);
      if (!emailValidation.valid) {
        newErrors.email =
          emailValidation.error || "Please enter a valid email address";
      }
    }

    // Validate telephone (optional, Australian format, max 15 chars per DB schema)
    if (phoneNumber && phoneNumber.trim() !== "") {
      // First check format validation
      const formatError = getPhoneValidationError(phoneNumber);
      if (formatError) {
        newErrors.telephone = formatError;
      } else {
        // Then check with existing validation
        const phoneValidation = validateAustralianPhone(phoneNumber);
        if (!phoneValidation.valid) {
          newErrors.telephone =
            phoneValidation.error ||
            "Please enter a valid Australian phone number";
        }
      }
    }

    // Validate customer address (optional, TEXT field - reasonable limit)
    if (address && address.length > 1000) {
      newErrors.customer_address = "Address must be 1000 characters or less";
    }

    // Validate cost centre (optional, max 255 chars per migration)
    if (costCentre && costCentre.length > 255) {
      newErrors.customer_cost_centre =
        "Cost centre must be 255 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveCustomer = () => {
    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    // Derive wholesale_type and service_type from customer type
    // Always send both fields so non-wholesale types get cleared to null
    const getWholesaleFields = () => {
      if (customerType === "Full Service Wholesale") {
        return { wholesale_type: "premium", service_type: "Full Service Wholesaler" };
      } else if (customerType === "Partial Service Wholesale") {
        return { wholesale_type: "essential", service_type: "Partial Service Wholesaler" };
      }
      // For Retail, Club Members etc — clear wholesale fields
      return { wholesale_type: null, service_type: null };
    };

    const data = {
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      email: customerEmail.trim() || null,
      telephone: cleanPhoneNumber(phoneNumber) || null,
      customer_address: address.trim() || null,
      customer_type: customerType,
      customer_notes: additionalNotes.trim() || null,
      customer_cost_centre: costCentre.trim() || null,
      company_id: selectedCompany ? Number(selectedCompany) : null,
      department_id: selectedDepartment ? Number(selectedDepartment) : null,
      estimated_opening_date: estimatedOpeningDate || null,
      discount_percentage: discountPercentage
        ? Number(discountPercentage)
        : null,
      pay_later: payLater,
      status: 1,
      archived: false,
      ...getWholesaleFields(),
    };

    if (selectedCustomer) {
      updateCustomerMutation.mutate({ id: selectedCustomer.customer_id, data });
    } else {
      createCustomerMutation.mutate(data);
    }
  };

  const handleArchive = (customer: Customer) => {
    setConfirmCustomerId(customer.customer_id);
    setConfirmCustomerName(`${customer.firstname} ${customer.lastname}`);
    setConfirmAction("archive");
    setShowConfirmModal(true);
  };

  const handleRestore = (customerId: number) => {
    restoreCustomerMutation.mutate(customerId);
  };

  const handleDelete = (customer: Customer) => {
    setConfirmCustomerId(customer.customer_id);
    setConfirmCustomerName(`${customer.firstname} ${customer.lastname}`);
    setConfirmAction("delete");
    setShowConfirmModal(true);
  };

  const handleConfirmAction = () => {
    if (!confirmCustomerId) return;

    if (confirmAction === "archive") {
      archiveCustomerMutation.mutate(confirmCustomerId);
    } else if (confirmAction === "delete") {
      deleteCustomerMutation.mutate(confirmCustomerId);
    }

    setShowConfirmModal(false);
    setConfirmCustomerId(null);
    setConfirmCustomerName("");
    setConfirmAction(null);
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setConfirmCustomerId(null);
    setConfirmCustomerName("");
    setConfirmAction(null);
  };

  const resetForm = () => {
    setCustomerType("");
    setFirstname("");
    setLastname("");
    setPhoneNumber("");
    setCustomerEmail("");
    setAddress("");
    setAdditionalNotes("");
    setCostCentre("");
    setSelectedCompany("");
    setSelectedDepartment("");
    setEstimatedOpeningDate("");
    setDiscountPercentage("");
    setPayLater(false);
    setErrors({});
  };

  const isWholesale = customerType?.includes("Wholesale");
  const isWholesaleTypeSelected = selectedType?.includes("Wholesale");

  return (
    <div
      className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden"
      style={{ fontFamily: "Albert Sans" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-gray-900"
          style={{
            fontFamily: "Albert Sans",
            fontWeight: 600,
            fontStyle: "normal",
            fontSize: "40px",
            lineHeight: "20px",
            letterSpacing: "0%",
          }}
        >
          Customers
        </h1>
        <Button
          onClick={handleAddCustomer}
          className="bg-[#105a9c] hover:bg-[#0d4a82] text-white whitespace-nowrap"
          style={{
            fontWeight: 600,
            width: "196px",
            height: "54px",
            paddingTop: "8px",
            paddingRight: "16px",
            paddingBottom: "8px",
            paddingLeft: "16px",
            gap: "4px",
            borderRadius: "67px",
            opacity: 1,
          }}
        >
          <Plus className="h-5 w-5" />
          Add New Customer
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-stretch sm:items-center">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search Order ID, Customer ID, Status etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[488px] h-[54px] border border-gray-200 bg-white rounded-full focus:ring-2 focus:ring-[#105a9c] focus:border-[#105a9c] focus:outline-none"
            style={{
              fontFamily: "Albert Sans",
              paddingLeft: "44px",
              paddingRight: "12px",
              paddingTop: "8px",
              paddingBottom: "8px",
            }}
          />
        </div>
        <div className="ml-auto flex-shrink-0">
          <Button
            onClick={() => printTableData("Customers")}
            className="gap-2 whitespace-nowrap border-0 shadow-none w-full sm:w-auto"
            style={{
              fontFamily: "Albert Sans",
              fontWeight: 600,
              fontStyle: "normal",
              fontSize: "16px",
              lineHeight: "20px",
              letterSpacing: "0%",
              textAlign: "center",
              color: "#105a9c",
              backgroundColor: "transparent",
              padding: 0,
              gap: "8px",
              opacity: 1,
            }}
          >
            <Printer className="h-5 w-5 text-[#105a9c]" />
            Print
          </Button>
        </div>
      </div>

      {/* Customer Type Tabs */}
      <div className="flex gap-2 sm:gap-3 mb-6 flex-wrap">
        {customerTypes.map((type: any) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${selectedType === type
              ? "bg-[#e7f1ff] text-[#105a9c] border-2 border-[#105a9c]"
              : "bg-white text-gray-700 border-2 border-gray-200 hover:border-gray-300"
              }`}
            style={{ fontFamily: "Albert Sans", fontWeight: 500 }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Active/Archived/Pending Approval Tabs */}
      <div className="flex gap-6 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("Active")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "Active"
            ? "border-[#105a9c] text-[#105a9c]"
            : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
        >
          Active ({activeCountData?.count || 0})
        </button>
        {selectedType !== "Retail" && (
          <button
            onClick={() => setActiveTab("Pending Approval")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 relative ${activeTab === "Pending Approval"
              ? "border-[#105a9c] text-[#105a9c]"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
          >
            Pending Approval
            {pendingCountData?.count > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                {pendingCountData?.count}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab("Archived")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "Archived"
            ? "border-[#105a9c] text-[#105a9c]"
            : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
        >
          Archived ({archivedCountData?.count || 0})
        </button>
      </div>

      {/* Table */}
      <Card className="border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-[#105a9c] border-b border-[#0d4a82] text-white">
                  <th
                    className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap"
                    style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                  >
                    Customer Name
                  </th>
                  <th
                    className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap"
                    style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                  >
                    Contact
                  </th>
                  <th
                    className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden lg:table-cell"
                    style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                  >
                    Address
                  </th>
                  <th
                    className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden xl:table-cell"
                    style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                  >
                    Company
                  </th>
                  {isWholesaleTypeSelected && (
                    <th
                      className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap hidden xl:table-cell"
                      style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                    >
                      Department
                    </th>
                  )}
                  <th
                    className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-white whitespace-nowrap"
                    style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={isWholesaleTypeSelected ? 6 : 5}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Loading customers...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isWholesaleTypeSelected ? 6 : 5}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      No customers found
                    </td>
                  </tr>
                ) : (
                  customers.map((customer: Customer) => (
                    <tr
                      key={customer.customer_id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className="text-gray-900 text-xs sm:text-sm"
                            style={{
                              fontFamily: "Albert Sans",
                              fontWeight: 400,
                              fontStyle: "normal",
                              lineHeight: "20px",
                              letterSpacing: "0%",
                            }}
                          >
                            {customer.firstname} {customer.lastname}
                          </div>
                          {customer.created_from === "storefront" &&
                            activeTab !== "Pending Approval" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Frontend
                              </span>
                            )}
                          {activeTab === "Pending Approval" && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${customer.has_similar_company ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {customer.has_similar_company ? 'Similar Company Found' : 'Pending'}
                            </span>
                          )}
                        </div>
                        {customer.customer_cost_centre && (
                          <div
                            className="text-gray-500 text-xs sm:text-sm mt-1"
                            style={{
                              fontFamily: "Albert Sans",
                              fontWeight: 400,
                              fontStyle: "normal",
                              lineHeight: "20px",
                              letterSpacing: "0%",
                            }}
                          >
                            CC: {customer.customer_cost_centre}
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <span
                          className="text-gray-700 text-xs sm:text-sm"
                          style={{
                            fontFamily: "Albert Sans",
                            fontWeight: 400,
                            fontStyle: "normal",
                            lineHeight: "20px",
                            letterSpacing: "0%",
                          }}
                        >
                          {customer.telephone || "-"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 hidden lg:table-cell">
                        <span
                          className="text-gray-700 line-clamp-2 text-xs sm:text-sm"
                          style={{
                            fontFamily: "Albert Sans",
                            fontWeight: 400,
                            fontStyle: "normal",
                            lineHeight: "20px",
                            letterSpacing: "0%",
                          }}
                        >
                          {customer.customer_address || "-"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-4 hidden xl:table-cell">
                        <span
                          className="text-gray-700 text-xs sm:text-sm"
                          style={{
                            fontFamily: "Albert Sans",
                            fontWeight: 400,
                            fontStyle: "normal",
                            lineHeight: "20px",
                            letterSpacing: "0%",
                          }}
                        >
                          {customer.company_name || customer.company?.company_name || "-"}
                        </span>
                      </td>
                      {isWholesaleTypeSelected && (
                        <td className="px-3 sm:px-4 py-3 sm:py-4 hidden xl:table-cell">
                          <span
                            className="text-gray-700 text-xs sm:text-sm"
                            style={{
                              fontFamily: "Albert Sans",
                              fontWeight: 400,
                              fontStyle: "normal",
                              lineHeight: "20px",
                              letterSpacing: "0%",
                            }}
                          >
                            {customer.department_name || customer.department?.department_name || "-"}
                          </span>
                        </td>
                      )}
                      <td className="px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          {activeTab === "Pending Approval" ? (
                            <>
                              {customer.has_similar_company && (
                                <button
                                  onClick={() => setMapCompanyCustomer(customer)}
                                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                                  title="Map Company"
                                >
                                  Map Company
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  approveCustomerMutation.mutate(
                                    customer.customer_id
                                  )
                                }
                                disabled={
                                  approveCustomerMutation.isPending ||
                                  rejectCustomerMutation.isPending
                                }
                                className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                title="Approve"
                              >
                                {approveCustomerMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  rejectCustomerMutation.mutate(
                                    customer.customer_id
                                  )
                                }
                                disabled={
                                  approveCustomerMutation.isPending ||
                                  rejectCustomerMutation.isPending
                                }
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                {rejectCustomerMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditCustomer(customer)}
                                className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setShowDiscountModal(true);
                                }}
                                className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Product Option Discounts"
                              >
                                <DollarSign className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(customer)}
                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              {activeTab === "Active" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleArchive(customer)}
                                  className="gap-1 border-gray-300 text-gray-700 hover:text-gray-900"
                                  style={{
                                    fontFamily: "Albert Sans",
                                    fontWeight: 600,
                                  }}
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleRestore(customer.customer_id)
                                  }
                                  className="gap-1 border-gray-300 text-gray-700 hover:text-gray-900"
                                  style={{
                                    fontFamily: "Albert Sans",
                                    fontWeight: 600,
                                  }}
                                >
                                  <RotateCw className="h-4 w-4" />
                                  Restore
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Add Customer Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          if (!open) {
            setIsClosingModal(true);
            setErrors({});
            resetForm();
            setShowAddModal(false);
            setTimeout(() => setIsClosingModal(false), 200);
          } else {
            setShowAddModal(open);
          }
        }}
      >
        <DialogContent
          className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto"
          style={{ fontFamily: "Albert Sans" }}
          onCloseClick={() => {
            // Immediately prevent validation when X button is clicked
            setIsClosingModal(true);
            setErrors({});
          }}
          onInteractOutside={(e) => {
            setIsClosingModal(true);
            setErrors({});
          }}
          onEscapeKeyDown={(e) => {
            setIsClosingModal(true);
            setErrors({});
          }}
        >
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Plus className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Add New Customer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Type */}
            <div className="space-y-2">
              <Label
                htmlFor="customerType"
                className="text-sm font-medium text-gray-700"
              >
                Select Customer Type *
              </Label>
              <Select value={customerType} onValueChange={setCustomerType}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {customerTypes.map((type: any) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {customerType && (
              <>
                <div className="pt-2 space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    Enter Customer Details
                  </p>

                  {/* First Name */}
                  <ValidatedInput
                    label="First Name"
                    placeholder="First Name"
                    value={firstname}
                    validationRule={ValidationRules.customer.firstname}
                    fieldName="First Name"
                    error={errors.firstname}
                    skipValidation={isClosingModal}
                    onChange={(value, isValid) => {
                      setFirstname(value);
                      if (isValid) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.firstname;
                          return newErrors;
                        });
                      }
                    }}
                    className="h-11 border-gray-300"
                  />

                  {/* Last Name */}
                  <ValidatedInput
                    label="Last Name"
                    placeholder="Last Name"
                    value={lastname}
                    validationRule={ValidationRules.customer.lastname}
                    fieldName="Last Name"
                    error={errors.lastname}
                    skipValidation={isClosingModal}
                    onChange={(value, isValid) => {
                      setLastname(value);
                      if (isValid) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.lastname;
                          return newErrors;
                        });
                      }
                    }}
                    className="h-11 border-gray-300"
                  />

                  {/* Phone Number */}
                  <div>
                    <Label className="text-sm text-gray-600">
                      Phone Number
                    </Label>
                    <Input
                      type="tel"
                      placeholder={getPhonePlaceholder()}
                      value={phoneNumber}
                      onChange={(e) => {
                        const previousValue = phoneNumber;
                        const formatted = formatAustralianPhone(
                          e.target.value,
                          previousValue
                        );
                        setPhoneNumber(formatted);

                        // Real-time validation
                        if (formatted.trim() !== "") {
                          const validationError =
                            getPhoneValidationError(formatted);
                          if (validationError) {
                            setErrors((prev) => ({
                              ...prev,
                              telephone: validationError,
                            }));
                          } else {
                            setErrors((prev) => ({
                              ...prev,
                              telephone: undefined,
                            }));
                          }
                        } else {
                          setErrors((prev) => ({
                            ...prev,
                            telephone: undefined,
                          }));
                        }
                      }}
                      onBlur={() => {
                        // Final validation on blur
                        if (phoneNumber && phoneNumber.trim() !== "") {
                          const validationError =
                            getPhoneValidationError(phoneNumber);
                          if (validationError) {
                            setErrors((prev) => ({
                              ...prev,
                              telephone: validationError,
                            }));
                          } else {
                            // Also check with existing validation
                            const phoneValidation =
                              validateAustralianPhone(phoneNumber);
                            if (!phoneValidation.valid) {
                              setErrors((prev) => ({
                                ...prev,
                                telephone:
                                  phoneValidation.error || validationError,
                              }));
                            } else {
                              setErrors((prev) => ({
                                ...prev,
                                telephone: undefined,
                              }));
                            }
                          }
                        }
                      }}
                      maxLength={20}
                      className={`h-11 border-gray-300 ${errors.telephone ? "border-red-500" : ""
                        }`}
                    />
                    {errors.telephone && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.telephone}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <ValidatedInput
                    label="Email"
                    type="email"
                    placeholder="Email"
                    value={customerEmail}
                    validationRule={ValidationRules.customer.email}
                    fieldName="Email"
                    error={errors.email}
                    skipValidation={isClosingModal}
                    onChange={(value, isValid) => {
                      setCustomerEmail(value);
                      if (isValid) {
                        setErrors((prev) => {
                          const newErrors = { ...prev };
                          delete newErrors.email;
                          return newErrors;
                        });
                      }
                    }}
                    className="h-11 border-gray-300"
                  />

                  {/* Address */}
                  <ValidatedTextarea
                    label="Address"
                    placeholder="Address"
                    value={address}
                    validationRule={ValidationRules.customer.customer_address}
                    fieldName="Address"
                    skipValidation={isClosingModal}
                    onChange={(value) => setAddress(value)}
                    className="min-h-[80px] border-gray-300"
                  />

                  {/* Wholesale specific fields */}
                  {isWholesale && (
                    <>
                      {/* Company */}
                      <div>
                        <Label className="text-sm text-gray-600">Company</Label>
                        <Select
                          value={selectedCompany}
                          onValueChange={setSelectedCompany}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map((company: Company) => (
                              <SelectItem
                                key={company.company_id}
                                value={company.company_id.toString()}
                              >
                                {company.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Department */}
                      {selectedCompany && (
                        <div>
                          <Label className="text-sm text-gray-600">
                            Department
                          </Label>
                          <Select
                            value={selectedDepartment}
                            onValueChange={setSelectedDepartment}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept: Department) => (
                                <SelectItem
                                  key={dept.department_id}
                                  value={dept.department_id.toString()}
                                >
                                  {dept.department_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Cost Centre */}
                      <ValidatedInput
                        label="Cost Centre"
                        placeholder="Cost Centre Code"
                        value={costCentre}
                        validationRule={
                          ValidationRules.customer.customer_cost_centre
                        }
                        fieldName="Cost Centre"
                        error={errors.customer_cost_centre}
                        skipValidation={isClosingModal}
                        onChange={(value, isValid) => {
                          setCostCentre(value);
                          if (isValid) {
                            setErrors((prev) => {
                              const newErrors = { ...prev };
                              delete newErrors.customer_cost_centre;
                              return newErrors;
                            });
                          }
                        }}
                        className="h-11 border-gray-300"
                      />

                      {/* Estimated Opening Date */}
                      <div>
                        <Label className="text-sm text-gray-600">
                          Estimated Opening Date
                        </Label>
                        <Input
                          type="date"
                          value={estimatedOpeningDate}
                          onChange={(e) =>
                            setEstimatedOpeningDate(e.target.value)
                          }
                          className="h-11 border-gray-300"
                        />
                      </div>
                    </>
                  )}

                  {/* Additional Notes */}
                  <ValidatedTextarea
                    label="Additional Notes"
                    placeholder="Enter notes here..."
                    value={additionalNotes}
                    validationRule={ValidationRules.customer.customer_notes}
                    fieldName="Additional Notes"
                    skipValidation={isClosingModal}
                    onChange={(value) => setAdditionalNotes(value)}
                    rows={3}
                    className="border-gray-300 resize-none"
                  />

                  {/* Pay Later Toggle */}
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="pay-later"
                      checked={payLater}
                      onCheckedChange={setPayLater}
                    />
                    <Label htmlFor="pay-later">Enable Pay Later</Label>
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsClosingModal(true);
                  setErrors({});
                }}
                onClick={(e) => {
                  e.preventDefault();
                  setIsClosingModal(true);
                  setErrors({});
                  resetForm();
                  setShowAddModal(false);
                  setTimeout(() => setIsClosingModal(false), 100);
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCustomer}
                disabled={!customerType || createCustomerMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white disabled:opacity-50"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              >
                {createCustomerMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal */}
      <Dialog
        open={showEditModal}
        onOpenChange={(open) => {
          if (!open) {
            // Blur active element to prevent validation on blur
            if (
              document.activeElement &&
              document.activeElement instanceof HTMLElement
            ) {
              document.activeElement.blur();
            }
            resetForm(); // Clear form and errors when closing
          }
          setShowEditModal(open);
        }}
      >
        <DialogContent
          className="max-w-md max-h-[90vh] overflow-y-auto"
          style={{ fontFamily: "Albert Sans" }}
        >
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mx-auto mb-4">
              <Edit className="h-6 w-6 text-[#105a9c]" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Edit Customer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Customer Type */}
            <div className="space-y-2">
              <Label
                htmlFor="editCustomerType"
                className="text-sm font-medium text-gray-700"
              >
                Customer Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={customerType}
                onValueChange={(value) => {
                  setCustomerType(value);
                  if (errors.customerType) {
                    setErrors((prev) => ({ ...prev, customerType: undefined }));
                  }
                }}
              >
                <SelectTrigger
                  className={`h-11 ${errors.customerType ? "border-red-500" : ""
                    }`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {customerTypes.map((type: any) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.customerType && (
                <p className="text-sm text-red-500">{errors.customerType}</p>
              )}
            </div>

            <div className="pt-2 space-y-3">
              <p className="text-sm font-medium text-gray-700">
                Customer Details
              </p>

              {/* First Name */}
              <div>
                <Label className="text-sm text-gray-600">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="First Name"
                  value={firstname}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 255) {
                      setFirstname(value);
                      if (errors.firstname) {
                        setErrors((prev) => ({
                          ...prev,
                          firstname: undefined,
                        }));
                      }
                    }
                  }}
                  maxLength={255}
                  className={`h-11 border-gray-300 ${errors.firstname ? "border-red-500" : ""
                    }`}
                />
                {errors.firstname && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.firstname}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <Label className="text-sm text-gray-600">
                  Last Name
                </Label>
                <Input
                  placeholder="Last Name"
                  value={lastname}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 255) {
                      setLastname(value);
                      if (errors.lastname) {
                        setErrors((prev) => ({ ...prev, lastname: undefined }));
                      }
                    }
                  }}
                  maxLength={255}
                  className={`h-11 border-gray-300 ${errors.lastname ? "border-red-500" : ""
                    }`}
                />
                {errors.lastname && (
                  <p className="text-sm text-red-500 mt-1">{errors.lastname}</p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <Label className="text-sm text-gray-600">Phone Number</Label>
                <Input
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 50) {
                      setPhoneNumber(value);
                      if (errors.telephone) {
                        setErrors((prev) => ({
                          ...prev,
                          telephone: undefined,
                        }));
                      }
                    }
                  }}
                  maxLength={50}
                  className={`h-11 border-gray-300 ${errors.telephone ? "border-red-500" : ""
                    }`}
                />
                {errors.telephone && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.telephone}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label className="text-sm text-gray-600">Email</Label>
                <Input
                  type="email"
                  placeholder="Email"
                  value={customerEmail}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= 255) {
                      setCustomerEmail(value);
                      if (errors.email) {
                        setErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }
                  }}
                  maxLength={255}
                  className={`h-11 border-gray-300 ${errors.email ? "border-red-500" : ""
                    }`}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <Label className="text-sm text-gray-600">Address</Label>
                <Input
                  placeholder="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-11 border-gray-300"
                />
              </div>

              {/* Wholesale specific fields */}
              {isWholesale && (
                <>
                  {/* Company */}
                  <div>
                    <Label className="text-sm text-gray-600">Company</Label>
                    <Select
                      value={selectedCompany}
                      onValueChange={setSelectedCompany}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company: Company) => (
                          <SelectItem
                            key={company.company_id}
                            value={company.company_id.toString()}
                          >
                            {company.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Department */}
                  {selectedCompany && (
                    <div>
                      <Label className="text-sm text-gray-600">
                        Department
                      </Label>
                      <Select
                        value={selectedDepartment}
                        onValueChange={setSelectedDepartment}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept: Department) => (
                            <SelectItem
                              key={dept.department_id}
                              value={dept.department_id.toString()}
                            >
                              {dept.department_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Cost Centre */}
                  <div>
                    <Label className="text-sm text-gray-600">Cost Centre</Label>
                    <Input
                      placeholder="Cost Centre Code"
                      value={costCentre}
                      onChange={(e) => setCostCentre(e.target.value)}
                      className="h-11 border-gray-300"
                    />
                  </div>

                  {/* Estimated Opening Date */}
                  <div>
                    <Label className="text-sm text-gray-600">
                      Estimated Opening Date
                    </Label>
                    <Input
                      type="date"
                      value={estimatedOpeningDate}
                      onChange={(e) => setEstimatedOpeningDate(e.target.value)}
                      className="h-11 border-gray-300"
                    />
                  </div>
                </>
              )}

              {/* Discount Percentage - Available for ALL customers */}
              <div>
                <Label className="text-sm text-gray-600">
                  Discount Percentage (%)
                  <span className="text-xs text-gray-500 ml-2">
                    (0-100, applies to all products)
                  </span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="e.g., 15 for 15% discount"
                  value={discountPercentage}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (
                      value === "" ||
                      (Number(value) >= 0 && Number(value) <= 100)
                    ) {
                      setDiscountPercentage(value);
                    }
                  }}
                  className="h-11 border-gray-300"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set a discount percentage for this customer. This will be
                  applied to all products in the storefront.
                </p>
              </div>

              {/* Additional Notes */}
              <div>
                <Label className="text-sm text-gray-600">
                  Additional Notes
                </Label>
                <Textarea
                  placeholder="Enter notes here..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                  className="border-gray-300 resize-none"
                />

                {/* Pay Later Toggle - Edit Mode */}
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="edit-pay-later"
                    checked={payLater}
                    onCheckedChange={setPayLater}
                  />
                  <Label htmlFor="edit-pay-later">Enable Pay Later</Label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCustomer(null);
                  resetForm();
                }}
                variant="outline"
                className="flex-1 border-gray-300"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCustomer}
                disabled={updateCustomerMutation.isPending}
                className="flex-1 bg-[#105a9c] hover:bg-[#0d4a82] text-white"
                style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
              >
                {updateCustomerMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "Albert Sans", fontWeight: 700 }}
            >
              {confirmAction === "archive"
                ? "Archive Customer"
                : "Delete Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${confirmAction === "archive" ? "bg-yellow-100" : "bg-red-100"
                  }`}
              >
                {confirmAction === "archive" ? (
                  <Archive className={`h-6 w-6 text-yellow-600`} />
                ) : (
                  <Trash2 className={`h-6 w-6 text-red-600`} />
                )}
              </div>
              <div className="flex-1">
                <p
                  className="text-sm text-gray-600 mb-2"
                  style={{ fontFamily: "Albert Sans" }}
                >
                  {confirmAction === "archive"
                    ? "Are you sure you want to archive this customer?"
                    : "Are you sure you want to permanently delete this customer? This action cannot be undone."}
                </p>
                <p
                  className="text-base font-semibold text-gray-900"
                  style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
                >
                  {confirmCustomerName}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleCancelConfirm}
              className="border-gray-300"
              style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              className={`${confirmAction === "archive"
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-red-600 hover:bg-red-700"
                } text-white`}
              style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
            >
              {confirmAction === "archive" ? "Archive" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Option Discounts Modal */}
      <Dialog open={showDiscountModal} onOpenChange={setShowDiscountModal}>
        <DialogContent
          className="max-w-5xl max-h-[90vh] overflow-y-auto"
          style={{ fontFamily: "Albert Sans" }}
        >
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto mb-4">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Product Option Discounts
            </DialogTitle>
            <p className="text-center text-sm text-gray-600 mt-2">
              Configure discounts for {selectedCustomer?.firstname}{" "}
              {selectedCustomer?.lastname}
            </p>
          </DialogHeader>

          <ProductOptionDiscountsContent
            customerId={selectedCustomer?.customer_id}
            onClose={() => {
              setShowDiscountModal(false);
              setSelectedCustomer(null);
              setDiscounts({});
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Map Company Modal */}
      <Dialog open={!!mapCompanyCustomer} onOpenChange={(open) => { if (!open) setMapCompanyCustomer(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Albert Sans', fontWeight: 600 }}>
              Map Company - {mapCompanyCustomer?.firstname} {mapCompanyCustomer?.lastname}
            </DialogTitle>
          </DialogHeader>
          {mapCompanyCustomer && (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Company submitted by customer:</p>
                <p className="text-base font-semibold text-yellow-900 mt-1">{mapCompanyCustomer.company_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Similar existing companies found:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mapCompanyCustomer.similar_companies?.map((company: any) => (
                    <div
                      key={company.company_id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <span className="text-sm font-medium">{company.company_name}</span>
                      <Button
                        size="sm"
                        disabled={mappingCompany}
                        onClick={async () => {
                          setMappingCompany(true);
                          try {
                            await customersAPI.mapCompany(mapCompanyCustomer.customer_id, { company_id: company.company_id });
                            toast.success(`Mapped to "${company.company_name}"`);
                            setMapCompanyCustomer(null);
                            queryClient.invalidateQueries({ queryKey: ['customers'] });
                          } catch (err: any) {
                            toast.error(err.response?.data?.message || 'Failed to map company');
                          } finally {
                            setMappingCompany(false);
                          }
                        }}
                        className="bg-[#105a9c] hover:bg-[#0d4a82] text-white text-xs"
                      >
                        Map to this
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  disabled={mappingCompany}
                  onClick={async () => {
                    setMappingCompany(true);
                    try {
                      await customersAPI.mapCompany(mapCompanyCustomer.customer_id, { approve_new: true });
                      toast.success(`Approved "${mapCompanyCustomer.company_name}" as new company`);
                      setMapCompanyCustomer(null);
                      queryClient.invalidateQueries({ queryKey: ['customers'] });
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Failed to approve company');
                    } finally {
                      setMappingCompany(false);
                    }
                  }}
                  className="w-full border-green-300 text-green-700 hover:bg-green-50"
                >
                  Approve &quot;{mapCompanyCustomer.company_name}&quot; as New Company
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Product Option Discounts Component
interface ProductOptionDiscountsContentProps {
  customerId?: number;
  onClose: () => void;
}

interface ProductOption {
  product_option_id: number;
  option_value_id: number;
  option_value_name: string;
  option_base_price?: number;
  option_price: number;
  option_price_prefix: string;
  discount_percentage: number;
  customer_product_option_discount_id?: number;
}

interface ProductWithOptions {
  product_id: number;
  product_name: string;
  options?: ProductOption[];
  has_options?: boolean;
  // For products without options
  product_price?: number;
  discount_percentage?: number;
  customer_product_discount_id?: number;
}

interface ProductWithoutOptions {
  product_id: number;
  product_name: string;
  product_price: number;
  discount_percentage: number;
  customer_product_discount_id?: number;
  has_options: false;
}

function ProductOptionDiscountsContent({
  customerId,
  onClose,
}: ProductOptionDiscountsContentProps) {
  const queryClient = useQueryClient();
  const [localDiscounts, setLocalDiscounts] = useState<Record<string, number>>(
    {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch products with options and current discounts
  const {
    data: discountsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["customer-product-option-discounts", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      try {
        const response = await customersAPI.getProductOptionDiscounts(
          customerId
        );
        return response.data;
      } catch (err: any) {
        console.error("Error fetching product option discounts:", err);
        // Re-throw with more details
        const errorMessage =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load product discounts";
        const errorDetails = err?.response?.data?.details;
        throw new Error(
          `${errorMessage}${errorDetails ? `: ${JSON.stringify(errorDetails)}` : ""
          }`
        );
      }
    },
    enabled: !!customerId,
    retry: false, // Don't retry on error to prevent multiple calls
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    staleTime: 0, // Always refetch when modal opens
  });

  // Initialize local discounts from fetched data
  useEffect(() => {
    if (discountsData?.products) {
      const initialDiscounts: Record<string, number> = {};
      discountsData.products.forEach((product: ProductWithOptions) => {
        if (
          product.has_options &&
          product.options &&
          product.options.length > 0
        ) {
          // Product with options - option-level discounts
          product.options.forEach((option: ProductOption) => {
            const key = `${product.product_id}_${option.option_value_id}`;
            initialDiscounts[key] = option.discount_percentage || 0;
          });
        } else {
          // Product without options - product-level discount
          const key = `product_${product.product_id}`;
          initialDiscounts[key] = product.discount_percentage || 0;
        }
      });
      setLocalDiscounts(initialDiscounts);
    }
  }, [discountsData]);

  // Save discounts
  const saveMutation = useMutation({
    mutationFn: async (discountsToSave: Record<string, number>) => {
      if (!customerId) return;

      const discountsArray = Object.entries(discountsToSave)
        .filter(([_, value]) => value > 0) // Only include discounts > 0
        .map(([key, value]) => {
          if (key.startsWith("product_")) {
            // Product-level discount (no options)
            const product_id = parseInt(key.replace("product_", ""));
            return {
              product_id: product_id,
              option_value_id: null, // null indicates product-level discount
              discount_percentage: parseFloat(value.toString()),
            };
          } else {
            // Option-level discount
            const [product_id, option_value_id] = key.split("_").map(Number);
            return {
              product_id: product_id,
              option_value_id: option_value_id,
              discount_percentage: parseFloat(value.toString()),
            };
          }
        });

      return await customersAPI.setProductOptionDiscounts(
        customerId,
        discountsArray
      );
    },
    onSuccess: async () => {
      // Invalidate and refetch the query to show updated discounts
      await queryClient.invalidateQueries({
        queryKey: ["customer-product-option-discounts", customerId],
      });
      await queryClient.refetchQueries({
        queryKey: ["customer-product-option-discounts", customerId],
      });
      toast.success("Product option discounts saved successfully");
      setIsSaving(false);
    },
    onError: (error: any) => {
      console.error("Save discounts error:", error);
      toast.error(error.response?.data?.message || "Failed to save discounts");
      setIsSaving(false);
    },
  });

  const handleDiscountChange = (
    productId: number,
    optionValueId: number | null,
    value: string
  ) => {
    let key: string;
    if (optionValueId !== null) {
      // Option-level discount
      key = `${productId}_${optionValueId}`;
    } else {
      // Product-level discount
      key = `product_${productId}`;
    }

    const numValue = parseFloat(value) || 0;
    const clampedValue = Math.max(0, Math.min(100, numValue)); // Clamp between 0-100
    setLocalDiscounts((prev) => ({
      ...prev,
      [key]: clampedValue,
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    saveMutation.mutate(localDiscounts);
  };

  const filteredProducts = useMemo(() => {
    if (!discountsData?.products) return [];

    const query = searchQuery.toLowerCase();
    return discountsData.products.filter((product: ProductWithOptions) => {
      const matchesName = product.product_name.toLowerCase().includes(query);
      if (matchesName) return true;

      // Also search in option names (if product has options)
      if (product.has_options && product.options) {
        return product.options.some((option: ProductOption) =>
          option.option_value_name.toLowerCase().includes(query)
        );
      }
      return false;
    });
  }, [discountsData, searchQuery]);

  if (!customerId) {
    return (
      <div className="text-center py-8 text-gray-500">No customer selected</div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">
          Loading products and discounts...
        </span>
      </div>
    );
  }

  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-2 font-semibold">
          Error loading product discounts
        </p>
        <p className="text-sm text-gray-600 mb-4">{errorMessage}</p>
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Search and Product Count */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <Input
          placeholder="Search products or options..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
        <div className="text-sm text-gray-600 whitespace-nowrap">
          {searchQuery ? (
            <span>
              Showing{" "}
              <span className="font-semibold">{filteredProducts.length}</span>{" "}
              of{" "}
              <span className="font-semibold">
                {discountsData?.products?.length || 0}
              </span>{" "}
              products
            </span>
          ) : (
            <span>
              Total:{" "}
              <span className="font-semibold">
                {discountsData?.products?.length || 0}
              </span>{" "}
              products
            </span>
          )}
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery
              ? "No products found matching your search"
              : "No products available"}
          </div>
        ) : (
          filteredProducts.map((product: ProductWithOptions) => {
            // Check if product actually has options (not just marked as has_options)
            const hasOptions =
              product.has_options &&
              product.options &&
              product.options.length > 0;

            return (
              <Card key={product.product_id} className="p-4">
                <h3 className="font-semibold text-lg mb-3 text-gray-900">
                  {product.product_name}
                </h3>

                {hasOptions ? (
                  // Product with options - show option-level discounts
                  <div className="space-y-3">
                    {product.options!.map((option: ProductOption) => {
                      const key = `${product.product_id}_${option.option_value_id}`;
                      const discountValue = localDiscounts[key] || 0;

                      // Calculate final price: base price (retail/wholesale) - discount percentage
                      const basePrice =
                        option.option_base_price || option.option_price;
                      const finalPrice =
                        discountValue > 0
                          ? basePrice * (1 - discountValue / 100)
                          : basePrice;

                      return (
                        <div
                          key={option.option_value_id}
                          className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {option.option_value_name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {discountValue > 0 ? (
                                <>
                                  <span className="line-through text-gray-500">
                                    Price: {option.option_price_prefix}$
                                    {basePrice.toFixed(2)}
                                  </span>
                                  <span className="ml-2 text-green-600 font-semibold">
                                    → {option.option_price_prefix}$
                                    {finalPrice.toFixed(2)} ({discountValue}%
                                    off)
                                  </span>
                                </>
                              ) : (
                                <span>
                                  Price: {option.option_price_prefix}$
                                  {basePrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={discountValue}
                              onChange={(e) =>
                                handleDiscountChange(
                                  product.product_id,
                                  option.option_value_id,
                                  e.target.value
                                )
                              }
                              className="w-24 text-right"
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-600 w-8">%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Product without options - show product-level discount
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        Product Price
                      </div>
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const key = `product_${product.product_id}`;
                          const discountValue = localDiscounts[key] || 0;
                          const basePrice = product.product_price || 0;
                          const finalPrice =
                            discountValue > 0
                              ? basePrice * (1 - discountValue / 100)
                              : basePrice;

                          return discountValue > 0 ? (
                            <>
                              <span className="line-through text-gray-500">
                                Price: ${basePrice.toFixed(2)}
                              </span>
                              <span className="ml-2 text-green-600 font-semibold">
                                → ${finalPrice.toFixed(2)} ({discountValue}%
                                off)
                              </span>
                            </>
                          ) : (
                            <span>Price: ${basePrice.toFixed(2)}</span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={
                          localDiscounts[`product_${product.product_id}`] || 0
                        }
                        onChange={(e) =>
                          handleDiscountChange(
                            product.product_id,
                            null,
                            e.target.value
                          )
                        }
                        className="w-24 text-right"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-600 w-8">%</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6 pt-4 border-t">
        <Button
          onClick={onClose}
          variant="outline"
          className="flex-1 border-gray-300"
          style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || saveMutation.isPending}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          style={{ fontFamily: "Albert Sans", fontWeight: 600 }}
        >
          {isSaving || saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save Discounts"
          )}
        </Button>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading customers...</div>}>
      <CustomersContent />
    </Suspense>
  );
}
